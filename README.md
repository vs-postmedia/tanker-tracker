# Burrard Inlet tanker tracker

Tracker for oil tankers in and out of the Westridge & Suncor oil terminals in Vancouver. Data collection began May 1, 2024, when the TransMountain Expansion (TMX) pipeline came online.

App uses [aisstream.io](https://aisstream.io/) to track tankers moored at Vancouver’s two oil terminals with the aim of creating a historical record of oil tanker traffic and to provide real-time updates about tanker movement in and out of the terminals.

Additional ship details are sourced from [Equasis.org](https://www.equasis.org/).

## Requirements

1. API Key from [aisstream.io](https://aisstream.io/authenticate)
2. Account for [Equasis.org](https://www.equasis.org/EquasisWeb/public/ConditionsRegistration?fs=HomePage)

Local & remote (github actions) scripts expect the following environment (.env) variables:
- API_KEY_AISSTREAM='xxx'
- PASS_EQUASIS='xxx'
- LOGIN_EQUASIS='xxx'

<em>NOTE: I have not yet tested a clean install from the github repo. There will almost certainly be bugs.</em>

## AIS Data Dictionary (ships-data.csv)

| Variable | Format | Description |
| --- | --- | --- |
| AisVersion | int | Either 1 or 2 |
| CallSign | string | Unique alphanumeric ID used by ships for radio communications |
| Destination | string | Ship’s reported destination (does not appear to be in a standardized format) |
| Dimension | string | In the format [Length]:[width] (in metres) |
| Dte | boolean | Data Terminal Equipment |
| Eta | string | In the format [Year,Month,Day,Hour,Minute] (24-hour format). The format has been modified from the standard AIS format |
| FixType | int | ??? |
| ImoNumber | int | 7-digit identified assigned to ships for their lifetime |
| MaximumStaticDraught | double | Max vertical distance between the waterline and the bottom of the hull (in metres) |
| MessageID | int | ??? |
| Name | string | Registered name of the ship |
| RepeatIndicator | int | ???? |
| Spare | boolean | ??? |
| Type | int | ??? |
| UserID | int | ??? |
| Valid| boolean | ??? |
| date | string | In the format [YYYY-MM-DD]. Based on time_utc timestamp |
| MMSI | int | Maritime Mobile Service Identity. 9-digit number. Can change over time |
| time_utc | string | utc datetime |
| terminal | string | Either Westridge or Suncor. Based on boundary boxes defined in [data/zone-coords.json](https://github.com/vs-postmedia/tanker-tracker/blob/master/data/zone-coords.json) |