
const twilio = require('twilio')
const TwilioMessagingResponse = twilio.twiml.MessagingResponse
const DocumentClient = require('aws-sdk/clients/dynamodb').DocumentClient
const EventBridge = require('aws-sdk/clients/eventbridge')
const dynamodb = new DocumentClient()
const eventBridge = new EventBridge()
const chance = require('chance').Chance()
const Log = require('@dazn/lambda-powertools-logger')
const wrap = require('@dazn/lambda-powertools-pattern-basic')
const { ssm } = require('middy/middlewares')

const serviceName = process.env.service_name
const stage = process.env.stage
const endpoint = process.env.twilio_webhook_endpoint

const tableName = process.env.reasons_table
const busName = process.env.bus_name

// Use a Scan to get all the reasons matching the filter expression, and we'll grab the first one in the array.
const getReason = async () => {
  console.log(`fetching 1 item from ${tableName}...`)
  const scanParams = {

    ExpressionAttributeValues: {
      ":u": "no"
    },
    FilterExpression: "used = :u",
    TableName: tableName,
  }

  const resp = await dynamodb.scan(scanParams).promise()

  // Each time a reason is used, we update an attribute for that item in the DB so that it won't be selected again.  If we only get one matching Item from the DB, this means we're at the end of a cycle through all 52 reasons.  We need to update all 52 items so they can be selected again (restart the cycle).  Publish an event to EventBridge to trigger another Lambda for that.
  if (resp.Items.length === 1) {
    const resetId = chance.guid()
    const reasonId = resp.Items[0].id
    const reason = resp.Items[0].reason
    console.log(`publishing Event to reset the Reasons DB...`)
    await eventBridge.putEvents({
      Entries: [{
        Source: '52_reasons_ily',
        DetailType: 'reset_reasons',
        Detail: JSON.stringify({
          resetId,
          reasonId,
          reason
        }),
        EventBusName: busName
      }]
    }).promise()

    console.log(`published 'reset_reasons' event into EventBridge`)
  }

  return resp.Items[0]
}

// After the first item from the DB response is selected and its "reason" is fed into the Twilio response, update its 3rd column in DynamoDB so that item won't be selected again.
const updateItem = async (reasonId) => {
  console.log(`updating the fetched item so it won't be fetched next time...`)

  const updateParams = {
    TableName: tableName,
    Key: { 
      id: reasonId
    },
    UpdateExpression: "set #u = :y",
    ExpressionAttributeNames: { "#u": "used" },
    ExpressionAttributeValues: { ":y": "yes" },
    ReturnValues: "UPDATED_NEW"
  }

  const resp = await dynamodb.update(updateParams).promise()
  console.log(`done update: ${resp}`)
  return resp
}

module.exports.handler = wrap(async (event, context) => {

  const headersArray = Object.values(event.headers)
  const twilioSignature = headersArray[headersArray.length - 1]

  const urlParams = new URLSearchParams(event.body)
  const params = Object.fromEntries(urlParams)
  Log.debug(`Log SMS Msg Received: `, { smsBody: params.Body })

  const requestIsValid = twilio.validateRequest(
    context.twilioAuthToken,
    twilioSignature,
    endpoint,
    params
  )
  
  const twiml = new TwilioMessagingResponse()

  let response = {}

  try {
    // Reject immediately with a standard JSON response if Twilio signature can't be validated
    if (!requestIsValid) {
      response.body = "Invalid Request"
      response.headers = { 'Content-Type': 'application/json' }
      response.statusCode = 400
    } else {
      // After Twilio signature is validated, check that the user's text message content was what it should be
      if ((params.Body === "mike") || (params.Body === "Mike")) {
        // Get a Reason from DynamoDB and update its "used" column (attribute) so it won't be selected next time
        const dbResponse = await getReason()
        twiml.message(`${dbResponse.reason}`)
        await updateItem(dbResponse.id)
      } else {
        // If the user's text message had the wrong content, prompt them to send the right one
        twiml.message('say my name')
      }
      // Load up the text message response to the user
      response.body = twiml.toString()
      response.headers = { 'Content-Type': 'text/xml' }
      response.statusCode = 200
    }
  } catch (e) {
    response.body = JSON.stringify(e)
    response.headers = { 'Content-Type': 'application/json' }
    response.statusCode = 500
  }

  Log.debug('Logging the response: ', { response })
  return response

}).use(ssm({
  cache: true,
  cacheExpiryInMillis: 5 * 60 * 1000,
  names: {
    twilioAuthToken: `/${serviceName}/${stage}/twilioAuthToken`
  },
  setToContext: true
}))