const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const { validationResult } = require('express-validator/check');

const User = require('../models/user');

const transporter = nodemailer.createTransport({
    service: 'hotmail',
    port: 587,
    secure: false,
    auth: {
        user: 'no-reply.dm@outlook.com',
        pass: 'noreply@dm',
    },
    tls: {
        rejectUnauthorized: false,
    },
});

// const transporter = nodemailer.createTransport(
//     sendgridTransport({
//         auth: {
//             api_key:
//                 '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',
//         },
//     })
// );

exports.getLogin = (req, res, next) => {
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }
    res.render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        errorMessage: message,
        oldInput: {
            email: '',
            password: '',
        },
        validationErrors: [],
    });
};

exports.getSignup = (req, res, next) => {
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }
    res.render('auth/signup', {
        path: '/signup',
        pageTitle: 'Signup',
        errorMessage: message,
        oldInput: {
            email: '',
            password: '',
            confirmPassword: '',
        },
        validationErrors: [],
    });
};

exports.postLogin = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: errors.array()[0].msg,
            oldInput: {
                email: email,
                password: password,
            },
            validationErrors: errors.array(),
        });
    }

    User.findOne({ email: email })
        .then((user) => {
            if (!user) {
                return res.status(422).render('auth/login', {
                    path: '/login',
                    pageTitle: 'Login',
                    errorMessage: 'Invalid email or password.',
                    oldInput: {
                        email: email,
                        password: password,
                    },
                    validationErrors: [],
                });
            }
            bcrypt
                .compare(password, user.password)
                .then((doMatch) => {
                    if (doMatch) {
                        req.session.isLoggedIn = true;
                        req.session.user = user;
                        return req.session.save((err) => {
                            console.log(err);
                            res.redirect('/');
                            return transporter.sendMail({
                                to: email,
                                from: 'DISHEN <no-reply.dm@outlook.com>',
                                // from: 'DISHEN <dixpatel9175@gmail.com>',
                                subject: 'Login succeeded!',
                                html: '<h1>You successfully logged in!</h1>',
                            });
                        });
                    }
                    return res.status(422).render('auth/login', {
                        path: '/login',
                        pageTitle: 'Login',
                        errorMessage: 'Invalid email or password.',
                        oldInput: {
                            email: email,
                            password: password,
                        },
                        validationErrors: [],
                    });
                })
                .catch((err) => {
                    console.log(err);
                    res.redirect('/login');
                });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postSignup = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors.array());
        return res.status(422).render('auth/signup', {
            path: '/signup',
            pageTitle: 'Signup',
            errorMessage: errors.array()[0].msg,
            oldInput: {
                email: email,
                password: password,
                confirmPassword: req.body.confirmPassword,
            },
            validationErrors: errors.array(),
        });
    }

    bcrypt
        .hash(password, 12)
        .then((hashedPassword) => {
            const user = new User({
                email: email,
                password: hashedPassword,
                cart: { items: [] },
            });
            return user.save();
        })
        .then((result) => {
            res.redirect('/login');
            return transporter.sendMail({
                to: email,
                from: 'DISHEN <no-reply.dm@outlook.com>',
                // from: 'DISHEN <dixpatel9175@gmail.com>',
                subject: 'Signup succeeded!',
                html: '<h1>You successfully signed up!</h1>',
            });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postLogout = (req, res, next) => {
    req.session.destroy((err) => {
        console.log(err);
        res.redirect('/');
    });
};

exports.getReset = (req, res, next) => {
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }
    res.render('auth/reset', {
        path: '/reset',
        pageTitle: 'Reset Password',
        errorMessage: message,
    });
};

exports.postReset = (req, res, next) => {
    crypto.randomBytes(32, (err, buffer) => {
        if (err) {
            console.log(err);
            return res.redirect('/reset');
        }
        const token = buffer.toString('hex');
        User.findOne({ email: req.body.email })
            .then((user) => {
                console.log(user);
                if (!user) {
                    req.flash('error', 'No account with this email found.');
                    return res.redirect('/reset');
                }
                user.resetToken = token;
                user.resetTokenExpiration = Date.now() + 3600000;
                return user.save();
            })
            .then((result) => {
                res.redirect('/');
                transporter.sendMail({
                    to: req.body.email,
                    from: 'DISHEN <no-reply.dm@outlook.com>',
                    // from: 'DISHEN <dixpatel9175@gmail.com>',
                    subject: 'Password reset',
                    html: `
                        <p>You requested for a password reset</p>
                        <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password.</p>
                        `,
                });
            })
            .catch((err) => {
                const error = new Error(err);
                error.httpStatusCode = 500;
                return next(error);
            });
    });
};

exports.getNewPassword = (req, res, next) => {
    const token = req.params.token;
    User.findOne({
        resetToken: token,
        resetTokenExpiration: { $gt: Date.now() },
    })
        .then((user) => {
            let message = req.flash('error');
            if (message.length > 0) {
                message = message[0];
            } else {
                message = null;
            }
            res.render('auth/new-password', {
                path: '/new-password',
                pageTitle: 'New Password',
                errorMessage: message,
                userId: user._id.toString(),
                passwordToken: token,
            });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postNewPassword = (req, res, next) => {
    const newPassword = req.body.password;
    const userId = req.body.userId;
    const passwordToken = req.body.passwordToken;
    let resetUser;
    let email;

    User.findOne({
        resetToken: passwordToken,
        resetTokenExpiration: { $gt: Date.now() },
        _id: userId,
    })
        .then((user) => {
            resetUser = user;
            email = user.email;
            return bcrypt.hash(newPassword, 12);
        })
        .then((hashedPassword) => {
            resetUser.password = hashedPassword;
            resetUser.resetToken = undefined;
            resetUser.resetTokenExpiration = undefined;
            return resetUser.save();
        })
        .then((result) => {
            res.redirect('/login');
            transporter.sendMail({
                to: email,
                from: 'DISHEN <no-reply.dm@outlook.com>',
                // from: 'DISHEN <dixpatel9175@gmail.com>',
                subject: 'Password reset Done',
                html: `
                    <p>Your password has been change</p>

                    <h4>Your Email: ${email}</h4>
                    <h4>Your new Password: ${newPassword}</h4>

                    <p>Do not share this password with anyone.</p>

                    -
                    <h4><b>DISHEN</b></h4>
                    <h4><b>shop@node-ecomm.com</b></h4>
                    `,
            });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

// const { google } = require('googleapis');

// const CLIENT_ID =
//     '29757254005-451ojbbpmpn7v843os9rbv289s1ojq4g.apps.googleusercontent.com';
// const CLEINT_SECRET = 'LBlQ8FbXkbn0UMjS7yLF4VAt';
// const REDIRECT_URI = 'https://developers.google.com/oauthplayground/';
// const REFRESH_TOKEN =
//     '1//04z5Y73uJdB8jCgYIARAAGAQSNwF-L9IrA3VGzu_qhM1kOAxtGujzYMYBB70kr5MUvxvrfWF1Nrko87OLkWJPoAjN4V_hAdMZ8BI';
// const API_KEY = 'AIzaSyA_ZyCuY_eJzg49qdONAuDOGsfk0b2yFfg';

// const oAuth2Client = new google.auth.OAuth2(
//     CLIENT_ID,
//     CLEINT_SECRET,
//     REDIRECT_URI
// );
// oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// let transport = nodemailer.createTransport({
//     service: 'gmail',
//     port: 587,
//     auth: {
//         type: 'OAuth2',
//         user: 'noreply.nodedm@gmail.com',
//         pass: 'noreply@dm',
//         clientId: CLIENT_ID,
//         clientSecret: CLEINT_SECRET,
//         refreshToken: REFRESH_TOKEN,
//         apiKey: API_KEY,
//     },
// });

// const mailOptions = {
//     from: 'DISHEN <noreply.nodedm@gmail.com>',
//     to: email,
//     subject: 'Hello from gmail using API',
//     text: 'Hello from gmail email using API',
//     html: '<h1>Hello from gmail email using API</h1>',
// };
