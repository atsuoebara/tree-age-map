-- Read-only synthetic fixtures, no production inserts. activity_date is a date.
WITH runs(activity_date,km,region) AS (VALUES
 (date '2024-12-31',10::numeric,'A'),
 (date '2025-01-01',20,'A'), (date '2025-01-31',30,'A'),
 (date '2025-02-01',40,'A'), (date '2025-02-28',50,'B'),
 (date '2025-12-31',60,'C'), (date '2026-01-01',70,'C')),
first_regions AS (SELECT region,min(activity_date) first_date FROM runs
 WHERE activity_date>=date '2025-01-01' AND activity_date<date '2026-01-01' GROUP BY region)
SELECT
 (SELECT sum(km)=50 FROM runs WHERE activity_date>=date '2025-01-01' AND activity_date<date '2025-02-01') january_boundary,
 (SELECT sum(km)=90 FROM runs WHERE activity_date>=date '2025-02-01' AND activity_date<date '2025-03-01') february_boundary,
 (SELECT sum(km)=200 FROM runs WHERE extract(year FROM activity_date)=2025) historical_year,
 (SELECT count(*)=1 FROM first_regions WHERE extract(month FROM first_date)=2) only_new_regions,
 (SELECT count(*)=1 FROM first_regions WHERE extract(month FROM first_date)=12) december_boundary;
