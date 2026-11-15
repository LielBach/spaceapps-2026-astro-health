# Exception: Demo 1 combines two real astronauts, and says so

Demo 1 shows real NASA ultrasound scans of the internal jugular vein (Marshall-Goebel 2019, JAMA Network Open, CC-BY: Figure 3B before flight, Figure 3C with the thrombus on ISS flight day 50) as Maya's scans, while Maya's pre-flight labs come from an Inspiration4 subject. This breaks the rule in ADR 0003 that never combines real values from two people. We accept it only for Demo 1, because real scans make the ultrasound step convincing and no open per-astronaut data has both labs and vein scans.

Conditions:
- Maya is marked **COMPOSITE** in the UI, the pitch and the docs: "Composite of two real astronauts: pre-flight labs from an Inspiration4 crew member; ultrasound scans from an ISS crew member (Marshall-Goebel 2019, CC-BY)."
- Each scan carries its own source and license credit.
- The demo never claims that the scans and the labs belong to one person, or that ORBIVIT would have found the 2019 thrombosis.
- Demo 2 and any other demo still follow ADR 0003 with no exception.
