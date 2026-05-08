# Sherdan import report

Generated at: 2026-05-08T08:42:31.897Z

## Summary

| Area | Planned | Persisted / DB |
| --- | --- | --- |
| Entities | 153 rows / 151 unique | 151 imported (152 campaign total) |
| Identities | 81 | 81 |
| Secrets | 56 | 56 |
| PC hooks | 58 | 26 |
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
| Unresolved PC hooks | 32 |
| Parser warnings | 107 |

### Duplicate Planned Entity Rows

- `npc:Razza:` from Fazioni.md:316 (L'Ordine della Lanterna Cieca / Razza:); Fazioni.md:539 (L'Eclissi / Razza:)
- `npc:Aspetto:` from Fazioni.md:316 (L'Ordine della Lanterna Cieca / Aspetto:); Fazioni.md:539 (L'Eclissi / Aspetto:)

### Unresolved Entity Links

- `faction:il sussurro` -> `Tutte` (parser-table, unknown-target)
- `faction:il sussurro` -> `Occhi di Vetro (Tharros)` (parser-table, unknown-target)
- `organization:il sabotaggio di mitra` -> `NPC.md §60` (section-ref, unknown-target)

### Unresolved PC Hooks

- `Noel/Yancarlos` -> `npc:capitana lunacupa "la vedova"`: Lunacupa odia "Yancarlos" — o meglio, odiava il vero Yancarlos, che era un frequentatore violento dei bordelli. Se Noel si presenta come Yancarlos, l'accoglienza sarà gelida e potenzialmente letale. Se si presenta come sé stesso, la dinamica cambia completamente.
- `Axton` -> `npc:ammiraglio rotella`: Rivale intellettuale e potenziale alleato. Due artefici con filosofie opposte — Axton combina magia e tecnologia con equilibrio, Rotella vuole eliminare il biologico. Un dialogo tra loro sarebbe un duello di idee. Rotella rispetterebbe Axton e lo vorrebbe morto per rubargli i progetti.
- `Andros` -> `npc:ammiraglio rotella`: Le piastrine di Andros contengono un metallo sconosciuto. Se Rotella le vedesse, le vorrebbe analizzare — a qualsiasi costo.
- `Erevan` -> `npc:ammiraglio rotella`: Nessun interesse diretto. Rotella non capisce la magia non tecnologica e la considera rumore di fondo.
- `Andros` -> `npc:comandante ivar`: Entrambi sono ex militari di Eshterzyli. Ivar potrebbe riconoscere i tatuaggi tribali di Andros o le piastrine, e sapere qualcosa del dungeon dove la sua unità è morta.
- `Axton` -> `npc:comandante ivar`: Ivar ha bisogno di qualcuno che migliori le sue navi senza dover trattare con Rotella. Un artefice indipendente sarebbe prezioso.
- `Erevan` -> `npc:lady nyx`: Nyx sente la magia. La presenza di Erevan — e della sua ombra — è un'anomalia che attirerebbe la sua attenzione immediatamente. Potrebbe voler "collezionare" il pugnale di Erevan o studiare la sua ombra.
- `Noel` -> `npc:lady nyx`: I "volti rubati" di Noel sono esattamente il tipo di curiosità che affascina Nyx. Un Cangiante che indossa i volti delle sue vittime emotive? È una collezione vivente. Nyx vorrebbe "catalogarlo".
- `Erevan` -> `npc:il profeta delle maree`: L'obelisco nero (Mitra) nel Santuario e La Bocca (frammento del Re d'Ombra) sono collegati. Se Erevan e il Profeta fossero nella stessa stanza, le ombre di Erevan e la condensa del Profeta potrebbero reagire — un'attrazione reciproca inquietante.
- `Andros` -> `npc:il profeta delle maree`: Il dado d'oro di Malakor/Dante è il simbolo di Ophelia (divinità dei segreti). La collana di vertebre del Profeta contiene un vertebra specifica — un osso di una creatura dell'Era dei Canti che nessuno ha mai identificato. Se Andros la toccasse, la piastrina potrebbe reagire.
- `Axton` -> `npc:il profeta delle maree`: Il Profeta odia la tecnologia — la considera un'aberrazione della terra che si oppone al ritorno dell'acqua. Axton è l'incarnazione di tutto ciò che il Profeta disprezza. Un confronto tra i due sarebbe un dialogo tra il passato e il futuro, tra la fede e la scienza.
- `Noel` -> `npc:malakor "lo sfregiato"`: Nessun rapporto biologico. Noel non è figlio di Malakor. È un Cangiante con storia tragica autonoma, con linea di sangue Vespera per discendenza naturale. Yancarlos era un luogotenente della Resistenza che cercava i Vascelli — quando Noel lo ha ucciso, ha decapitato (senza saperlo) un nodo della Resistenza. Malakor ne ha beneficiato indirettamente: la rete della Resistenza si è indebolita di una pedina. Se Malakor scoprisse che Noel è il Vascello di Vespera, lo proteggerebbe (gli serve maturo). Per ora non sa esattamente quale dei sette sia il Vascello di quale fratello.
- `Axton` -> `npc:malakor "lo sfregiato"`: L'esplosione della Brass Raven è stata un sabotaggio della Resistenza — Saeth aveva ordinato l'eliminazione del Vascello di Meliador prima della maturazione. Malakor non era coinvolto. Quando Darian/Chiave Rotta ha disertato salvando Axton con l'impianto di Obsidium, Malakor lo ha seguito da lontano e ha capito che Darian aveva sviluppato una soluzione intermedia — *rallentare* invece di *uccidere* — che gli serviva. Se Darian fosse riuscito a contattare la Resistenza per condividere il metodo, Saeth avrebbe potuto rallentare gli altri Vascelli invece di ucciderli. Malakor ha tagliato i contatti di Darian per impedire la trasmissione del metodo. Darian vive in fuga anche grazie/a causa di Malakor.
- `Andros` -> `npc:malakor "lo sfregiato"`: La Forgia dei Sigilli era un obiettivo della Resistenza (Ghorrax voleva distruggere i progetti dei sei). Era anche un obiettivo di Eshterzyli (manipolata dalla propaganda dei sei attraverso intelligence corrotta della Loggia). Malakor non era coinvolto in nessuna delle due squadre. Ma è interessato alla Forgia perché contiene la verità sepolta da Ophelia — verità che, se uscisse, distruggerebbe non solo il piano dei sei ma probabilmente anche il suo. Andros che ricorda è un rischio per Malakor quanto per i sei. È uno dei pochi punti su cui Malakor e i sei hanno interesse comune.
- `Axton` -> `faction:la synapse`: La Synapse potrebbe essere l'organizzazione che ha sabotato la Brass Raven — attraverso la Divisione Sicurezza, su ordine dell'Eclissi infiltrata. Oppure indipendentemente, perché Axton era vicino a una scoperta che avrebbe minacciato il monopolio. Le due possibilità non si escludono.
- `Axton` -> `faction:l'istituto della genesi`: Il nucleo di Obsidium nel suo petto è esattamente ciò che l'Istituto cerca di replicare. Se Lyssia sapesse della sua esistenza, manderebbe una squadra di recupero.
- `Andros` -> `faction:l'istituto della genesi`: Il Muto ha tatuaggi simili alle tribù Genasi che hanno accolto Andros. Se si incontrassero, Andros potrebbe scoprire il programma Chimera attraverso i flashback del Muto.
- `Axton` -> `faction:le spine`: Bersaglio naturale. Un artefice con tecnologia nel petto è tutto ciò che le Spine odiano incarnato in una persona.
- `Andros` -> `faction:la legione di cenere`: Era un soldato di Eshterzyli. La sua unità potrebbe aver avuto collegamenti con la Legione. Le piastrine al collo portano il simbolo di Eshterzyli — un Legionario che le vedesse reagirebbe.
- `Axton` -> `faction:il sussurro`: L'oggetto parlante dato a Pip ha creato un legame che il Sussurro non aveva previsto. Se il party volesse usare Pip come tramite per accedere alla rete, potrebbe farlo — ma Trama potrebbe chiedere un prezzo.
- `Tutti` -> `faction:il sussurro`: Il Sussurro è la fonte più accessibile di informazioni a Domus Nova. Ma ogni informazione ha un prezzo — e a volte il prezzo è un'informazione in cambio. Cosa è disposto a rivelare il party?
- `Noel` -> `faction:il sussurro`: Come ex spia militare e manipolatore, Noel capirebbe istintivamente la struttura del Sussurro. Potrebbe voler entrare nella rete — o manipolarla.
- `Axton` -> `faction:l'ordine della lanterna cieca`: Bersaglio assoluto. Un Reborn tenuto in vita da un nucleo di Obsidium è la prova vivente di tutto ciò che l'Ordine combatte. Se una cellula scoprisse Axton, cercherebbe di ucciderlo e *estrarre* il nucleo.
- `Erevan` -> `faction:l'ordine della lanterna cieca`: Lo stregone delle ombre è un'altra abominazione — magia nera incarnata. L'Ordine lo caccerebbe senza esitazione.
- `Andros` -> `faction:concilio delle voci (urash)`: Goliath — cultura condivisa. Thrum potrebbe riconoscerlo come discendente di una linea Goliath specifica. Le piastrine militari susciterebbero interesse e disprezzo.
- `Tutti` -> `faction:la loggia degli archeologi`: La Loggia è l'alleata naturale del party nel Capitolo 2. Possono fornire mappe, informazioni sui Santuari, equipaggiamento da esplorazione e contatti in ogni regione. L'alleanza è una pistola alla tempia in slow motion: ogni "successo" condiviso con la Loggia è un Trono attivato e una maturazione accelerata. La Loggia è benevola e competente; questo è ciò che la rende l'antagonista più pericoloso del Capitolo 2 dopo Malakor.
- `Axton` -> `faction:la loggia degli archeologi`: Il disertore dell'Eclissi che lo ha salvato è collegato alla Loggia — è Chiave Rotta, l'agente sotto copertura scomparso. Se Axton trovasse Darian, avrebbe la fonte di intelligence più preziosa del mondo, ma userebbe una mappa parziale e parzialmente sbagliata (Darian conosce la Resistenza, non i sei fratelli).
- `Andros` -> `faction:la loggia degli archeologi`: La Forgia dei Sigilli è un sito che la Loggia sta cercando da decenni. Se sapessero che Andros ci è stato — e che le piastrine contengono una chiave d'accesso — lo cercherebbero con urgenza. Tornare alla Forgia con la Loggia significa portarli a leggere la verità che Ophelia ha sepolto. Buono per Andros, terribile per la Loggia: i loro fondamenti crollerebbero. Marah potrebbe essere la prima Chiave a rompersi se vedesse i progetti reali dei Vascelli.
- `Erevan/Azazel` -> `faction:l'eclissi`: Saeth sa che Malakor ha creato un Vascello fac-simile — il "settimo Sigillo". Per lei, Azazel è uno strumento di Malakor, il canale verso il piano del traditore. Non vuole ucciderlo per principio — vuole capire cosa sta succedendo. Non vuole eliminarlo come gli altri sei Vascelli perché Azazel non è un vascello dei sei fratelli; è qualcosa di nuovo. Distruggerlo potrebbe liberare Mitra (esito desiderato) o aprire un canale incontrollato verso il Vuoto (catastrofe). Saeth è cauta. Per ora osserva.
- `Axton` -> `faction:l'eclissi`: L'Eclissi ha tentato di sabotare la Brass Raven per uccidere Axton — eutanasia rituale del Vascello di Meliador prima della maturazione. Ordine doloroso ma considerato necessario. Darian/Chiave Rotta ha disertato in quel momento, salvandolo. Saeth lo cerca ancora. Non sa che ha rallentato la maturazione invece di azzerare il Vascello. Se Saeth scoprisse il rallentamento, sarebbe sorpresa: una soluzione che non aveva considerato.
- `Andros` -> `faction:l'eclissi`: La Forgia dei Sigilli era un obiettivo della Resistenza — Ghorrax era lì per distruggere i progetti dei sei fratelli. La squadra di Andros era invece di Eshterzyli, manipolata dalla propaganda della Loggia (filtrata attraverso intelligence corrotta). Le due squadre si sono scontrate. Le difese del Trono hanno ucciso quasi tutti. Andros è sopravvissuto perché Vascello di Ophelia. Ghorrax non lo sa: pensa che Andros sia un soldato di Eshterzyli sopravvissuto per fortuna. Se Andros ricordasse la verità della Forgia (la verità sepolta da Ophelia), Ghorrax sarebbe la persona più sorpresa di tutta Sherdan.
- `Noel` -> `faction:l'eclissi`: Il vero Yancarlos era un luogotenente fidato dell'Eclissi sotto Saeth. Quando Noel lo ha ucciso, ha decapitato senza saperlo un nodo importante della Resistenza. La cellula che riportava a Yancarlos è andata in silenzio per tre anni. Saeth non sa che Yancarlos è morto. Crede che sia in copertura profonda o in pericolo. Se scoprisse che Noel ha ucciso il suo agente — e che Noel è il Vascello di Vespera — la sua reazione sarebbe imprevedibile: fra dover punire l'omicidio di un alleato e dover identificare un Vascello a fini operativi, la lotta tra emozione e dovere sarebbe il dialogo più lacerante che potrebbe avere.

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
