# Burrard Inlet tanker tracker

Tracker for oil tankers in and out of the Westridge, Suncor and Parkland oil terminals in Vancouver and the Kitimat terminal. Data collection began May 1, 2024, when the TransMountain Expansion (TMX) pipeline came online.

App uses [aisstream.io](https://aisstream.io/) to track moored tankers.

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
| Variable | Format | Description | Details
| --- | --- | --- |
| AisVersion | int | Either 1 or 2 | Class A === 2, Class B === 2
| CallSign | string | Unique alphanumeric ID used by ships for radio communications |
| Destination | string | Ship’s reported destination | Does not appear to be in a standardized format
| Dimension | string | In the format [Length]:[width] (in metres) | Calculated by adding Dimension A+B (length) & Dimension C+D (width)
| Dte | boolean | Data Terminal Equipment | Used to signal whether the transmitting station’s terminal equipment is ready
| Eta | string | In the format [Year,Month,Day,Hour,Minute] (24-hour format) | Modified from the standard AIS format
| FixType | int | The type of electronic positioning system used to determine the vessel’s position. | 1 === GPS
| ImoNumber | int | 7-digit identified assigned to ships for their lifetime |
| MaximumStaticDraught | double | Max vertical distance between the waterline and the bottom of the hull (in metres) |
| MessageID | int | The type of AIS message being sent | 5 === Static & voyage related data
| Name | string | Registered name of the ship |
| RepeatIndicator | int | Value between 0 and 3. Used by the repeater to indicate how many times a message has been repeated | 0 = default; 3 = do not repeat any more
| Spare | boolean | Not used. Reserved for future use. |
| Type | int | AIS Message Type, which identifies the kind of information being transmitted |
| UserID | int | Unique identifier for transmitting vessel | Typically MMSI
| Valid| boolean | Data considered valid or accurate |
| date | string | In the format [YYYY-MM-DD] | Derived from time_utc timestamp
| MMSI | int | Maritime Mobile Service Identity. 9-digit number | Can change over time
| time_utc | string | utc datetime |
| terminal | string | One of Westridge, Suncor, Parkland or Kitmat | Based on boundary boxes defined in [data/zone-coords.json](https://github.com/vs-postmedia/tanker-tracker/blob/master/data/zone-coords.json)


See USCG for more info on AIS messages: https://www.navcen.uscg.gov/ais-messages