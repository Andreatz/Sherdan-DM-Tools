# Sherdan import report

Generated at: 2026-05-08T08:53:16.839Z

## Summary

| Area | Planned | Persisted / DB |
| --- | --- | --- |
| Entities | 153 rows / 151 unique | 151 imported (152 campaign total) |
| Identities | 81 | 81 |
| Secrets | 56 | 56 |
| PC hooks | 58 rows / 70 assignments | 70 |
| Entity links | 45 | 45 |
| Sessions | 6 | 6 |
| Plot threads | 10 | 10 |
| Rule documents | 47 | 47 |

## Planned Entities By Type

| Type | Count |
| --- | --- |
| pc | 7 |
| npc | 92 |
| faction | 17 |
| deity | 1 |
| organization | 15 |
| location | 21 |

## DB Imported Entities By Type

| Type | Count |
| --- | --- |
| pc | 7 |
| npc | 90 |
| location | 21 |
| faction | 17 |
| organization | 15 |
| deity | 1 |

## Embeddings

| Metric | Count |
| --- | --- |
| Imported entities with embedding | 151 |
| Imported entities missing embedding | 0 |

## Skipped / Unresolved

| Kind | Count |
| --- | --- |
| Duplicate planned entity rows | 2 |
| Unresolved entity links | 3 |
| Unresolved PC hooks | 0 |
| Parser warnings | 107 |

### Duplicate Planned Entity Rows

- `npc:Razza:` from Fazioni.md:316 (L'Ordine della Lanterna Cieca / Razza:); Fazioni.md:539 (L'Eclissi / Razza:)
- `npc:Aspetto:` from Fazioni.md:316 (L'Ordine della Lanterna Cieca / Aspetto:); Fazioni.md:539 (L'Eclissi / Aspetto:)

### Unresolved Entity Links

- `faction:il sussurro` -> `Tutte` (parser-table, unknown-target)
- `faction:il sussurro` -> `Occhi di Vetro (Tharros)` (parser-table, unknown-target)
- `organization:il sabotaggio di mitra` -> `NPC.md §60` (section-ref, unknown-target)

### Unresolved PC Hooks

None.

## Parser Warnings

- Background Personaggi.md:1 (Althea: Elfa Alta, Ladra) - Livello non presente nel sorgente: impostato a 1.
- Background Personaggi.md:21 (Andros Fortebraccio: Goliath, Guerriero) - Livello non presente nel sorgente: impostato a 1.
- Background Personaggi.md:45 (Azazel: Cangiante, Stregone delle ombre) - Livello non presente nel sorgente: impostato a 1.
- Background Personaggi.md:86 (Axton “Uomo di ferro” Arkwright, Umano Reborn, Artefice) - Livello non presente nel sorgente: impostato a 1.
- Background Personaggi.md:143 (Bellamy, Elfo del mare, Ranger) - Livello non presente nel sorgente: impostato a 1.
- Background Personaggi.md:157 (Noel Estragon: Cangiante, Bardo) - Livello non presente nel sorgente: impostato a 1.
- Background Personaggi.md:178 (Melir: Aasimar, Paladino della Conquista) - Livello non presente nel sorgente: impostato a 1.
- NPC.md:301 (6. Grog "Mano di Legno" - Mezzorco, Monaco) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:308 (7. Zio Baryl - Tiefling, Ranger) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:316 (8. Sestante - Costrutto, Artefice) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:322 (9. Madame Z - Tabaxi, Ladro) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:329 (10. Pip - Kenku, Ladro) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:340 (11. Percival, l'Inquisitore Caduto - Umano, Chierico) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:349 (12. Silas (Morto) - Umano, Ranger) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:354 (13. Jax "Il Bello" - Mezzelfo, Guerriero) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:365 (14. Lady Suture - Umana, Maga) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:375 (15. Scrappy "Scintilla" - Goblin, Artefice) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:386 (16. "Il Muto" - Goliath, Barbaro) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:396 (17. Olyvia "Pollice Verde" - Halfling, Druido) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:405 (18. Brufolo il Cuoco - Orco, Barbaro) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:413 (19. Spettro - Cangiante, Ladro) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:550 (21. Matriarca Sylvanas - Elfa Alta, Druida) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:559 (22. Alto Druido Thorn - Minotauro, Druido) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:566 (23. Ambasciatrice Lysandra - Mezzelfa, Maga) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:573 (24. Saggio Ooran - Tortuga, Monaco) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:580 (25. Varis il Plasmatore - Drow, Stregone) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:588 (26. Marlo l'Assassino - Tabaxi, Ladro) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:596 (27. Ryla della Tempesta - Umana, Stregone) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:604 (28. Maestra Elara - Elfa Alta, Ranger) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:614 (29. Kaela "Spina Nera" - Elfa dei Boschi, Ladra) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:624 (30–40. NPC Minori di Arbòrea) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:624 (30–40. NPC Minori di Arbòrea) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:640 (41. Gran Generale Krael - Mezzorco, Guerriero) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:649 (42. Signora della Guerra Vraxxa - Draconide Rossa, Barbaro) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:657 (43. Grand'Ammiraglio Torvin - Nano delle Montagne, Bardo) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:665 (44. Alto Inquisitore Moros - Duergar, Chierico) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:674 (45. Mastro Forgiatore Hestia - Umana, Guerriera) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:684 (46–60. NPC Minori di Eshterzyli) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:684 (46–60. NPC Minori di Eshterzyli) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:707 (61. Alto Artefice Valerius - Umano Reborn, Artefice) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:714 (62. Lady Beatrix "La Vedova d'Oro" - Umana) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:720 (63. Generale Octavia Steel - Umana, Guerriera) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:729 (64–75. NPC Restanti di Tharros) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:729 (64–75. NPC Restanti di Tharros) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:748 (76. Venerabile Oji) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:748 (76. Venerabile Oji) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:756 (77. Thrum "Cuore di Granito") - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:756 (77. Thrum "Cuore di Granito") - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:762 (78. La Signora degli Echi) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:762 (78. La Signora degli Echi) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:773 (79. Lama Tenzin / Lama Dorje) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:773 (79. Lama Tenzin / Lama Dorje) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:780 (80. Capitano Kael "Gelo Perenne") - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:780 (80. Capitano Kael "Gelo Perenne") - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:789 (81. Maestra Jian) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:789 (81. Maestra Jian) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:799 (82–90. NPC Minori di Urash) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:799 (82–90. NPC Minori di Urash) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:818 (91. Il Re d'Ombra) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:818 (91. Il Re d'Ombra) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:845 (92. Baba Jarda) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:845 (92. Baba Jarda) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:852 (93. Pa'Nino) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:852 (93. Pa'Nino) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:861 (94. Thaladir) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:861 (94. Thaladir) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:871 (95. Famiglia di Althea) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:871 (95. Famiglia di Althea) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:877 (96. Madre Illydia) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:877 (96. Madre Illydia) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:882 (97. Bouncin' Banshee (madre di Azazel)) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:882 (97. Bouncin' Banshee (madre di Azazel)) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:890 (98. Bartolomeo (Padre di Bellamy)) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:890 (98. Bartolomeo (Padre di Bellamy)) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:910 (99. Varek "L'Occhio") - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:910 (99. Varek "L'Occhio") - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:918 (100. Ghorrax "Il Pugno") - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:918 (100. Ghorrax "Il Pugno") - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:926 (101. "La Radice") - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:926 (101. "La Radice") - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:948 (102. "Chiave Rotta" / Darian Vex — RISCRITTURA SOSTANZIALE) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:974 (103. Marah "La Cartografa" — Modifica leggera) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:987 (104. "Trama") - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:987 (104. "Trama") - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:1004 (105. Domina Serena Voss) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:1004 (105. Domina Serena Voss) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:1010 (106. Fratello Ash) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:1010 (106. Fratello Ash) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:1018 (107. Primaria Lyssia Korr) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- NPC.md:1018 (107. Primaria Lyssia Korr) - Nessun Aggancio PG tabellare riconosciuto.
- NPC.md:1030 (NPC Minori delle Città) - Razza non riconosciuta dal blocco Identita' o dal titolo.
- Fazioni.md:1 (1. Le Valchirie della Burrasca) - Sezione segreti presente ma nessun segreto estratto.
- Fazioni.md:56 (4. I Collezionisti) - Sezione segreti presente ma nessun segreto estratto.
- Fazioni.md:234 (9. La Legione di Cenere) - Sezione Struttura non riconosciuta.
- Fazioni.md:234 (9. La Legione di Cenere) - Sezione segreti presente ma nessun segreto estratto.
- Fazioni.md:361 (12. Circolo dei Custodi (Arbòrea)) - Sezione Struttura non riconosciuta.
- Fazioni.md:388 (13. Consiglio del Progresso (Tharros)) - Sezione Struttura non riconosciuta.
- Fazioni.md:409 (14. Consiglio della Guerra (Eshterzyli)) - Sezione Struttura non riconosciuta.
- Fazioni.md:437 (15. Concilio delle Voci (Urash)) - Sezione Struttura non riconosciuta.
- Lore.md:930 (26. Bonorxili) - Possibile segreto non marcato con lock.
- Lore.md:973 (27. Ultima Dimora) - Possibile segreto non marcato con lock.
- Lore.md:1121 (30. Mare dei Sussurri — L'Incubo Psichico) - Possibile segreto non marcato con lock.
- Lore.md:1194 (32. Baia dei Corsari — Il Labirinto di Corallo) - Possibile segreto non marcato con lock.
- Lore.md:1238 (33. Zona Vulcanica (Eshterzyli)) - Possibile segreto non marcato con lock.
- Lore.md:1280 (34. Il Cuore Verde (Arbòrea)) - Possibile segreto non marcato con lock.
- Lore.md:1326 (35. Le Pianure Verdi (Tharros)) - Possibile segreto non marcato con lock.
- Lore.md:1372 (36. Montagne di Urash) - Possibile segreto non marcato con lock.
