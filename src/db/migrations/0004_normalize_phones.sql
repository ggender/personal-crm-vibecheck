-- Keep only digits and the leading plus in phone numbers.
UPDATE "contacts" SET "phone" = regexp_replace("phone", '[0-9]', '', 'g');
