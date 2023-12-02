const express = require("express");
const router = express.Router();
const AuthControllers = require("../../controllers/auth");
const auth = require("../../middleware/auth");
const jsonParser = express.json();


router.post("/register",jsonParser, AuthControllers.register);
router.post("/login", jsonParser, AuthControllers.login);
router.post("/logout", auth, AuthControllers.logout);
router.post("/current", auth, AuthControllers.current);
router.get("/verify/:verificationToken", AuthControllers.verify);
router.post("/verify",AuthControllers.verification );
module.exports = router;
