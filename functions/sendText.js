
const Twilio = require('twilio').twiml.MessagingResponse
const DocumentClient = require('aws-sdk/clients/dynamodb').DocumentClient
const EventBridge = require('aws-sdk/clients/eventbridge')
const dynamodb = new DocumentClient()
const eventBridge = new EventBridge()
const chance = require('chance').Chance()

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

  // If we only get one matching Item from the DB, this means the DB needs to be reset.  Publish an event to EventBridge to trigger another Lambda for that.
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

// After the first item from the DB response is selected and its "reason" is fed into the Twilio response, update its 3rd column in DynamoDB so that item won't be repeated.
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

module.exports.handler = async (event, context, callback) => {
  
  const twiml = new Twilio()

  if (event.body.includes("mike") || event.body.includes("Mike")) {
    const dbResponse = await getReason()
    twiml.message(`${dbResponse.reason}`)
    await updateItem(dbResponse.id)
  } else {
    twiml.message('say my name')
  }
  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
    body: twiml.toString(),
  };

callback(null, response);
}