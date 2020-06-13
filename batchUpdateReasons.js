// transactWrite for the AWS DocumentClient can only update in batches of 10 at a time, so we split ID's up that way.  We'll export them from here and feed each batch into a helper function in the resetReasons lambda, which can be called sequentially to do the updates for us.  If we wanted to go even further to make this more scalable, we could have another lambda respond to Put Events in DynamoDB, run a scan to get all the IDs, and make these batches with the results from that scan.  That way we wouldn't have to maintain this file if e.g. we wanted to add more Reasons to DynamoDB.


const ten = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10
]

const twenty = [
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20
]

const thirty = [
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30
]

const forty = [
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40
]

const fifty = [
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50
]

const lastTwo = [
  51,
  52
]



module.exports.firstBatch = ten.map(x => ({
  id: x
}))

module.exports.secondBatch = twenty.map(x => ({
  id: x
}))

module.exports.thirdBatch = thirty.map(x => ({
  id: x
}))

module.exports.fourthBatch = forty.map(x => ({
  id: x
}))

module.exports.fifthBatch = fifty.map(x => ({
  id: x
}))

module.exports.lastBatch = lastTwo.map(x => ({
  id: x
}))