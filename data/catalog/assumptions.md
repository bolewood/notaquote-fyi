# Sprint 2 assumptions

This is the builder’s assumption log. It is not a review and it is not a sign-off.

1. The snapshot covers model years 2006 through 2027. 2027 is the newest year that both FuelEconomy.gov `vehicles.csv` and NHTSA vPIC returned on 21 September 2026.
2. FuelEconomy.gov `baseModel` is joined to the NHTSA model. The FuelEconomy.gov `model` string is the trim. No marketing trim (XLT, Lariat, or otherwise) was typed in.
3. Confidence is high when those base names agree, allowing only generic body or drivetrain suffixes such as 4WD or 4Dr. A slash in the FuelEconomy name, or a prefix that adds an identity word such as Lightning, is limited. An NHTSA passenger car or multipurpose passenger vehicle with no FuelEconomy join is one row named “Trim not resolved”.
4. NHTSA truck models with no FuelEconomy join are omitted. That drops Super Duty and medium-duty names such as F-250 and F-650. They are outside the FuelEconomy light-duty file, so no trim was invented for them. The source diff lists examples. Chassis, motorhome, trailer, bus, motorcycle, taxi, robotaxi, hearse, and limo names are excluded from both feeds.
5. A FuelEconomy make that NHTSA did not return for passenger car, truck, or multipurpose passenger vehicle stays in the snapshot under the FuelEconomy spelling at limited confidence. Scion is one of those makes.
6. Sample dollar weights for Ford F-150, Toyota RAV4, and Tesla Model Y are the sprint 1 sample display weights. Every other catalog vehicle uses weight 1. Those weights are not rating factors. Weak trim confidence changes the label only. The factor engine is a later sprint.
7. VIN decode is a browser call to `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json`. NHTSA must return error code 0. The field is cleared after the request. A failed decode does not change the picker. The decoded trim is used only when that name is already in the snapshot.
8. Search filters the snapshot in the browser. The catalog file is static. This server does not keep a vehicle profile.
9. The refresh window is 180 days from 21 September 2026. After 20 March 2027 the confidence line says the snapshot is past its refresh date.
10. `npm run catalog:build` is the refresh job. It writes the snapshot and `data/catalog/source-diff.md`. The raw FuelEconomy file and raw NHTSA responses stay in `.catalog-cache` and are not committed.
