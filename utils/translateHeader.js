function translateHeader (header, recipients) {
  if (header['from-salty-id'] && recipients[header['from-salty-id']]) {
    header['from-salty-id'] = recipients[header['from-salty-id']].toString(true)
  }
  if (header['to-salty-id'] && recipients[header['to-salty-id']]) {
    header['to-salty-id'] = recipients[header['to-salty-id']].toString(true)
  }
  return header
}
module.exports = translateHeader