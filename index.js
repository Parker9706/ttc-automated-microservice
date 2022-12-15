const Imap = require("imap");
const {simpleParser} = require("mailparser");
const twilio = require("twilio");
require("dotenv").config();

// ENV Variables for messaging
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const firstName = process.env.FIRST_NAME2;
const emailCode = process.env.EMAIL_CODE;
const email = process.env.MY_EMAIL;
const host = process.env.EMAIL_SERVER;

// e-mail credentials
const imapConfig = {
  user: email,
  password: emailCode,
  host: host,
  port: 993,
  tls: true,
};

// Query e-mail server & send message if applicable
const retrieveEmails = () => {
  try {
    // Initiate connection
    const imap = new Imap(imapConfig);
    imap.once("ready", () => {
      // Search TTC-Inbox label, unseen emails
      imap.openBox("TTC-Inbox", false, () => {
        imap.search(["UNSEEN", ["SINCE", new Date()]], (err, results) => {
          const f = imap.fetch(results, {bodies: ""});
          f.on("message", msg => {
            msg.on("body", stream => {
              // Parse all unread emails found
              simpleParser(stream, async (err, parsed) => {
                // Alert server
                const currentTime = new Date();
                console.log("New Alert Found, Current Time: " + currentTime.toGMTString());
                // Parse through email pieces
                const {from, subject, textAsHtml, text} = parsed;
                // Split HTML into elements of an array
                const splitHtml = textAsHtml.split("<p>");
                // Grab the time of the alert
                let timeStamp = splitHtml[4].slice(19, splitHtml[4].length-7);
                // Format the time into 12-hour time
                let firstDigits = timeStamp.slice(0, 2);
                if (firstDigits > 12) {
                  firstDigits = Number(firstDigits - 12);
                  firstDigits = firstDigits.toString();
                  firstDigits = firstDigits += timeStamp.slice(2, timeStamp.length);
                  timeStamp = firstDigits += "PM";
                } else {
                  // Add AM suffix
                  timeStamp += "AM";
                }
                // Grab the message from TTC Communication
                const ttcMessage = splitHtml[2].slice(0, splitHtml[2].length - 4);
                // Format into a text message
                const textMessage = `

                ${timeStamp}
                ${ttcMessage}`;

                console.log("E-Mail parsed successfully, initiating call to the Twilio API...");
                // Twillio API Call
                client.messages 
                  .create({body: textMessage, from: process.env.TWILIO_NUMBER, to: process.env.PARKER_PHONE_NUMBER})
                  .then(message => console.log(`Message successfully sent to ${firstName}!`))
                  .then(message => console.log("Message Text: ", textMessage))
                  .catch((err) => console.log("Failure: ", err, `The message was not sent to ${firstName}.`));    
              });
            });
            // Mark emails as 'seen'
            msg.once("attributes", attrs => {
              const {uid} = attrs;
              imap.addFlags(uid, ["\\Seen"], () => {
                // Mark the email as read after reading it
                console.log("Alert has been marked as read.");
              });
            });
          });
          // Error Handle
          f.once("error", ex => {
            return Promise.reject(ex);
          });
          // On successful end, close process and log message
          f.once("end", () => {
            imap.end();
          });
        });
      });
    });

    imap.once("error", err => {
      console.log(err);
    });

    imap.once("end", () => {
      console.log("Connection ended");
    });

    imap.connect();
  } catch (ex) {
    console.log("an error occurred");
  }
};

retrieveEmails();
// setInterval(retrieveEmails(), 30000);