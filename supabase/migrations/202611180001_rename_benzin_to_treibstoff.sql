-- Benennt die Kategorie inklusive aller bestehenden Kosten sicher um.
-- PostgreSQL übernimmt die vorhandenen Enum-Werte und abhängigen Constraints.
alter type public.cost_category rename value 'Benzin' to 'Treibstoff';
