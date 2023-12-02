const User = require("../models/users");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { userSchema, verifySchema } = require("../schemas/users");
const gravatar = require("gravatar");
const { nanoid } = require("nanoid");

// імпорт функції надсилання розсилки
const sendEmail = require("../helpers/sendEmail");

const register = async (req, res, next) => {
  const { email, password } = req.body;

  const avatarURL = gravatar.profile_url(`${email}`, {
    s: "200",
    r: "pg",
    d: "identicon",
  });

  try {
    const validation = userSchema.validate({ email, password, avatarURL });
    if (validation.error) {
      const errorMessage = validation.error.details
        .map((error) => error.message)
        .join(", ");
      return res.status(400).send(`Validation Error: ${errorMessage}`);
    }

    const user = await User.findOne({ email }).exec();
    if (user !== null) {
      return res.status(409).send({ message: "Email in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // генерація токена реєстрації
    const verifyToken = nanoid();

    // розсилка
    await sendEmail({
      to: email,
      subject: "Welcome to PhoneBook",
      html: `To confirm your registration please click on the <a href='http://localhost:3000/users/verify/:${verifyToken}'>Link</a>`,
      text: `To confirm your registration please open the link http://localhost:3000/users/verify/:${verifyToken}`,
    });

    const userCreate = await User.create({
      email,
      password: passwordHash,
      avatarURL,
      verificationToken: verifyToken,
    });

    const responseData = {
      user: {
        email: userCreate.email,
        subscription: userCreate.subscription,
        // додати аватар при реєстрації
        avatarURL: userCreate.avatarURL,
      },
    };
    res.status(201).json(responseData);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const validation = userSchema.validate({ email, password });
    if (validation.error) {
      const errorMessage = validation.error.details
        .map((error) => error.message)
        .join(", ");
      return res.status(400).send(`Validation Error: ${errorMessage}`);
    }

    const user = await User.findOne({ email }).exec();
    if (user === null) {
      return res.status(401).send({ message: "Email or password is wrong" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch === false) {
      return res.status(401).send({ message: "Email or password is wrong" });
    }
    // перевірка верифікації юзера
    if (user.verify !== true) {
      return res.status(401).send({ message: "your account is not verified" });
    }

    // підключення токена
    const token = jwt.sign(
      { id: user._id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    await User.findByIdAndUpdate(user._id, { token }).exec();
    res.send({
      token,
      user: {
        email: user.email,
        subscription: user.subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { token: null }).exec();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const current = async (req, res, next) => {
  try {
    const user = await User.findOne().exec();
    if (!user) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }
    res.send({
      email: user.email,
      subscription: user.subscription,
    });
  } catch (error) {
    next(error);
  }
};

const verify = async (req, res, next) => {
  const { verificationToken } = req.params;
  const userToken = verificationToken.slice(1);
  // console.log(userToken);
  // console.log(req.params);
  console.log({ verificationToken });
  console.log(req.body);
  try {
    const user = await User.findOne({
      verificationToken: userToken,
    }).exec();

    if (user === null) {
      return res.status(404).send({ message: "Not found" });
    }
    await User.findByIdAndUpdate(
      user._id,
      { verify: true, verificationToken: null },
      { new: true }
    );
    console.log(user);
    res.send({ message: "Email confirm successfully" });
  } catch (error) {
    next(error);
  }
};

const verification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "missing required field email" });
    }

    const validation = verifySchema.validate({ email });
    if (validation.error) {
      const errorMessage = validation.error.details
        .map((error) => error.message)
        .join(", ");
      return res.status(400).json(`Validation Error: ${errorMessage}`);
    }

    const user = await User.findOne({ email }).exec();

    // Перевірка, чи користувач вже пройшов верифікацію
    if (user && user.verify === true) {
      return res
        .status(400)
        .json({ message: "Verification has already been passed" });
    }
    //  якщо юзер не верифікований надіслати повторно лист верифікації
    if (user.verify === false) {
      // Використовуйте той самий токен, що і при реєстрації
      const verifyToken = user.verificationToken;
      // розсилка
      await sendEmail({
        to: email,
        subject: "Welcome to PhoneBook",
        html: `To confirm your registration please click on the <a href='http://localhost:3000/users/verify/:${verifyToken}'>Link</a>`,
        text: `To confirm your registration please open the link http://localhost:3000/users/verify/:${verifyToken}`,
      });
    }
    return res.json({
      "message": "Verification email sent"
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, logout, current, verify, verification };
