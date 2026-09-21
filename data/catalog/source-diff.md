# Vehicle catalog source diff

Initial snapshot. No earlier snapshot was in the repository, so this report is the baseline rather than a change list.

- Version: catalog-2026-09-21
- Retrieved: 2026-09-21
- Refresh after: 2027-03-20
- Model years: 2006–2027 (22 years with rows)
- FuelEconomy file: https://www.fueleconomy.gov/feg/epadata/vehicles.csv
- FuelEconomy description: https://www.fueleconomy.gov/feg/ws/index.shtml
- NHTSA models: https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeIdYear/
- FuelEconomy rows kept: 17451
- FuelEconomy rows excluded by name: 147
- Trim rows, high confidence: 14971
- Trim rows, limited confidence: 2478
- Trim rows, unresolved: 1231
- FuelEconomy rows filed on their own base model: 1097
- FuelEconomy rows attached with a weak prefix: 1382
- NHTSA truck models with no FuelEconomy join, omitted: 367
- Commercial chassis cabs omitted (Ram 2500, 3500, 4000, 4500, 5500, and Ford E-450): 75
- FuelEconomy makes with no NHTSA make: bmwalpina, bugattirimac, codaautomotive, ineosautomotive, mclarenautomotive, mobilityventuresllc, roushperformance, rufautomobile, saleenperformance, scion, srt, tecstarlp, vpg

Persona defaults this build wrote:

- Molly: 2023 Ford F-150, F150 Pickup 4WD
- Jayden: 2023 Toyota RAV4, RAV4
- Ava: 2023 Tesla Model Y, Model Y Long Range AWD

Omitted commercial chassis cabs (not a complete list):

- 2006 Ford E-450
- 2007 Ford E-450
- 2008 Ford E-450
- 2009 Ford E-450
- 2010 Ford E-450
- 2011 Ford E-450
- 2012 Ford E-450
- 2012 Ram 3500
- 2013 Ford E-450
- 2013 Ram 2500
- 2013 Ram 3500
- 2013 Ram 4000
- 2013 Ram 4500
- 2013 Ram 5500
- 2014 Ford E-450
- 2014 Ram 2500
- 2014 Ram 3500
- 2014 Ram 4000
- 2014 Ram 4500
- 2014 Ram 5500
- 2015 Ram 2500
- 2015 Ram 3500
- 2015 Ram 4000
- 2015 Ram 4500

Omitted truck examples (not a complete list):

- 2006 Mazda B-Series
- 2006 Ford F-250
- 2006 Ford F-350
- 2006 Ford F-450
- 2006 Ford F-550
- 2006 Ford F-650
- 2006 Ford F-750
- 2006 Volvo Cab Over Engine HT
- 2006 Volvo Cab Over Engine LT
- 2006 Volvo F12 w/F7 Cab
- 2006 Volvo F6 w/F7 Cab
- 2006 Volvo Cab Behind Engine
- 2006 Isuzu NQR/NRR
- 2006 Isuzu T6F
- 2006 Isuzu T7F
- 2006 Isuzu T8F
- 2006 Isuzu NPR
- 2006 Isuzu H-Series
- 2007 Mazda B-Series
- 2007 Ford F-250
- 2007 Ford F-350
- 2007 Ford F-450
- 2007 Ford F-550
- 2007 Ford F-650
- 2007 Ford F-750
- 2007 Volvo Cab Over Engine HT
- 2007 Volvo Cab Over Engine LT
- 2007 Volvo F12 w/F7 Cab
- 2007 Volvo F6 w/F7 Cab
- 2007 Volvo Cab Behind Engine
- 2007 Isuzu NQR/NRR
- 2007 Isuzu T6F
- 2007 Isuzu T7F
- 2007 Isuzu T8F
- 2007 Isuzu NPR
- 2007 Isuzu H-Series
- 2008 Mazda B-Series
- 2008 Ford F-250
- 2008 Ford F-350
- 2008 Ford F-450

Terms: Retrieved 21 September 2026. NHTSA vPIC (https://vpic.nhtsa.dot.gov/api/) is the manufacturer-submitted vehicle listing. Callers are subject to NHTSA’s automated rate control. This snapshot requests passenger car, truck, and multipurpose passenger vehicle models only and stores no VINs. FuelEconomy.gov vehicles.csv (https://www.fueleconomy.gov/feg/epadata/vehicles.csv) is the DOE and EPA fuel-economy file, described at https://www.fueleconomy.gov/feg/ws/index.shtml. This snapshot keeps year, make, base model, and model name. It does not keep fuel-cost or economy figures. Both are U.S. government public datasets, copied in this reduced form. Names the sources did not print were not added as trims.
