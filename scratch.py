S = 20252

-- Active
SELECT p.name
FROM Person p
WHERE EXISTS (
    SELECT 1
    FROM Membership m
    WHERE m.Person_id = p.Person_id
      AND m.start_semester <= 20241
      AND (m.end_semester IS NULL OR m.end_semester >= 20241)
);

-- Alumni

SELECT p.name
FROM Person p
WHERE NOT EXISTS (
    SELECT 1
    FROM Membership m
    WHERE m.Person_id = p.Person_id
      AND m.start_semester <= 20241
      AND (m.end_semester IS NULL OR m.end_semester >= 20241)
);