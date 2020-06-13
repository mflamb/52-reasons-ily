const { firstBatch, secondBatch, thirdBatch, fourthBatch, fifthBatch, lastBatch } = require('./../batchUpdateReasons.js')
const DocumentClient = require('aws-sdk/clients/dynamodb').DocumentClient
const dynamodb = new DocumentClient()

const tableName = process.env.reasons_table

const loopBatchUpdates = async (batch) => {
  for (const item of batch) {
    console.log(item)
    let req = {
      TransactItems: [{
        Update: {
          TableName: tableName,
          Key: item,
          UpdateExpression: "set #u = :n",
          ExpressionAttributeNames: { "#u": "used" },
          ExpressionAttributeValues: { ":n": "no" },
          ReturnValues: "UPDATED_NEW"
        }
      }]
    }
    dynamodb.transactWrite(req).promise()
      .then(() => console.log("all done"))
      .catch(err => console.error(err))

    // executeTransactWrite(req)
  }
}


module.exports.handler = async (event, context, callback) => {
  
  loopBatchUpdates(firstBatch)
  loopBatchUpdates(secondBatch)
  loopBatchUpdates(thirdBatch)
  loopBatchUpdates(fourthBatch)
  loopBatchUpdates(fifthBatch)
  loopBatchUpdates(lastBatch)

  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: `DB Reset!`,
  };

  callback(null, response);
}
