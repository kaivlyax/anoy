const nodemailer = require("nodemailer");


const sendEmail = async(
    email,
    otp
)=>{


const transporter =
nodemailer.createTransport({

    service:"gmail",

    auth:{
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS
    }

});


await transporter.sendMail({

    from:process.env.EMAIL_USER,

    to:email,

    subject:"ANOY Email Verification",

    text:
    `Your ANOY verification code is ${otp}`

});


};


module.exports = sendEmail;