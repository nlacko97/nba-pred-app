// ESPN uses a few short codes that differ from ours
const ESPN_TO_APP = {
  GS: 'GSW',
  NY: 'NYK',
  NO: 'NOP',
  SA: 'SAS',
  UTAH: 'UTA',
  WSH: 'WAS',
}

export const toAppAbbr = abbr => ESPN_TO_APP[abbr] || abbr

export const matchupKey = (awayAbbr, homeAbbr) => `${awayAbbr}@${homeAbbr}`
