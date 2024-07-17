# Vancouver Harbour tanker tracker

Tracker for oil tankers in and out of the Westridge terminal in Vancouver Harbour - terminus of the $34 billion TransCanada pipeline that came online on May 1, 2024.

App uses AisStream.js to tracking tankers moored at the Westridge terminal with the aim of creating a historical record of tanker traffic at Burnaby’s Westridge terminal (and by extension, Vancouver Harbour) and to provide real-time updates about tanker movement into and out of the terminal.

## Data Dictionary

| Variable | Format | Description |
| --- | --- | --- |
| AisVersion | int | Either 1 or 2 |
| CallSign | string | ships call sign |
| Destination | string | |
| Dimension | string | In the format [Length]:[width] |
| Dte| boolean| |
| Eta | string | In the format [Day,Hour,Minute,Month,Year] |
| FixType | int | |
| ImoNumber | int | |
| MaximumStaticDraught | double | |
| MessageID | int |  |
| Name | string | |
| RepeatIndicator | int  |
| Spare | boolean | |
| Type | int | |
| UserID | int | |
| Valid| boolean | |
| date | string | In the format [YYYY-MM-DD] |
| MMSI| int| |
| time_utc | string | utc datetime |
| terminal | string | Either Westridge or Suncor |