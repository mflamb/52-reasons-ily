const Messenger = require('./../messenger.js')
const middy = require('middy')
const { ssm } = require('middy/middlewares')

const { serviceName, stage } = process.env

const twilio = require('twilio')


module.exports.sendText = middy((event, context, callback) => {
  const twilioClient = twilio(context.twilioAccountSid, context.twilioAuthToken)

  const messenger = new Messenger(twilioClient)
  const parsedEvent = JSON.parse(event.body)

  const response = {
    headers: { 'Access-Control-Allow-Origin': '*' }, // CORS requirement
    statusCode: 200,
  }

  Object.assign(parsedEvent, { from: context.twilioPhoneNumber })

  messenger.send(parsedEvent)
  .then((message) => {
    // text message sent! ✅
    console.log(`message ${message.body}`)
    console.log(`date_created: ${message.dateCreated}`)
    response.body = JSON.stringify({
      message: 'Text message successfully sent!',
      data: message,
    })
    callback(null, response)
  })
  .catch((error) => {
    response.statusCode = error.status
    response.body = JSON.stringify({
      message: error.message,
      error: error,
    })
    callback(null, response)
  })
}).use(ssm({
  cache: true,
  cacheExpiryInMillis: 5 * 60 * 1000,
  names: {
    twilioAccountSid: `/${serviceName}/${stage}/twilioAccountSid`,
    twilioAuthToken: `/${serviceName}/${stage}/twilioAuthToken`,
    twilioPhoneNumber: `/${serviceName}/${stage}/twilioPhoneNumber`
  },
  setToContext: true
}))