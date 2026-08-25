-- Fix emergency_water pattern: remove invalid JS inline (?i) and restore wasserschaden
update public.rule_definitions
set
  pattern = 'rohrbruch|wasserschaden|notfall|wasseraustritt|leitung geplatzt|leitung ist geplatzt|leitung ist gerissen|starker wasseraustritt|wasser läuft überall|wasser strömt|überschwemm|überflut|garten steht unter wasser|keller steht unter wasser|wasser lässt sich nicht abstellen',
  change_note = coalesce(change_note || ' | ', '') || 'fix JS regex (?i) + restore wasserschaden'
where code = 'emergency_water';
