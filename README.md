# Vancouver Harbour tanker tracker

Tracker for oil tankers in and out of the Westridge terminal in Vancouver Harbour - terminus of the $34 billion TransCanada pipeline that came online on May 1, 2024.

App uses AisStream.js to tracking tankers moored at the Westridge terminal with the aim of creating a historical record of tanker traffic at Burnaby’s Westridge terminal (and by extension, Vancouver Harbour) and to provide real-time updates about tanker movement into and out of the terminal.

## Data Dictionary

| Variable | Format | Description |
| --- | --- | --- |
| AisVersion | int | Either 1 or 2 |
| CallSign | string | Unique alphanumeric ID used for radio communications |
| Destination | string | Ship’s reported destination (fdoes not appear to be in a standardized format) |
| Dimension | string | In the format [Length]:[width] (in metres) |
| Dte | boolean | Data Terminal Equipment |
| Eta | string | In the format [Year,Month,Day,Hour,Minute] (24-hour format). This metric has been modified from the standard AIS format |
| FixType | int | |
| ImoNumber | int | 7-digit identified assigned to ships or their lifetime |
| MaximumStaticDraught | double | Max vertical distance between the waterline and the bottom of the hull (in metres) |
| MessageID | int |  |
| Name | string | Registered name of the ship |
| RepeatIndicator | int  |
| Spare | boolean | |
| Type | int | |
| UserID | int | |
| Valid| boolean | |
| date | string | In the format [YYYY-MM-DD] |
| MMSI | int | Maritime Mobile Service Identity. 9-digit number. Can change over time |
| time_utc | string | utc datetime |
| terminal | string | Either Westridge or Suncor |