# Muon DFT

## Phase 1: Baselines & Chemical Potentials (The Foundation)

Before introducing any defects or muons, you must establish the pristine thermodynamic boundaries.
1. **Pristine Supercell:** Relax a $MAPbI_3$ supercell (e.g., **2x2x2** pseudo-cubic or tetragonal). You **must** use van der Waals corrections (e.g., DFT-D3) to correctly orient the MA molecules.
2. **Chemical Potentials ($\mu_{MA}$, $\mu_{Pb}$, $\mu_I$):** Defect formation energies depend on the growth conditions (I-rich vs. I-poor). Calculate the total energies of the competing bulk phases: solid $I_2$, bulk $Pb$, $PbI_2$, and solid $CH_3NH_3I$ (MAI). Use these to construct the thermodynamic stability polygon for $MAPbI_3$.
## Phase 2: Native Vacancies ($V_{MA}$, $V_{Pb}$, $V_I$)
Investigate the empty traps before the muon arrives.
1. **Generate Defects:** Remove MA, Pb, or I from the relaxed supercell.
2. **Charge States:** Vacancies in perovskites exist in multiple charge states.
    - $V_I$: typically $+1$, $0$, $-1$
    - $V_{Pb}$: typically $0$, $-1$, $-2$
    - $V_{MA}$: typically $0$, $-1$
3. **Relaxation:** Relax the ions at constant volume (`ISIF = 2`) using scalar-relativistic PBE+vdW.
4. **Static SOC:** Perform a single-point static calculation (`NSW = 0`) on the relaxed geometries with Spin-Orbit Coupling enabled. Apply FNV finite-size corrections and plot the formation energies vs. Fermi level ($E_F$) to find the thermodynamic transition levels.

## Phase 3: Muon Stopping Sites (Perfect vs. Defective)
Now, inject the positive muon ($\mu^+$).
1. **Perfect Lattice:** Use the UEP minima strategy to find where $\mu^+$ stops in the pristine crystal (likely bonding to I, or trapped near the negative dipole of the MA molecule). Relax and apply Zero-Point Energy (ZPE) corrections.
2. **Defect Trapping:** Place the $\mu^+$ inside or immediately adjacent to your native vacancies ($V_{MA}$, $V_{Pb}$, $V_I$).
    - _Hypothesis to test:_ $V_{Pb}$ and $V_{MA}$ are effectively negatively charged sites in the lattice, making them highly attractive Coulombic traps for a $\mu^+$.
3. **Binding Energy:** Calculate the binding energy: $E_b = E[\text{host + }\mu^+] + E[\text{host + }V_X] - E[\text{host + }V_X\text{ + }\mu^+] - E[\text{host}]$. A positive $E_b$ means the muon will be trapped by the vacancy.

## Phase 4: Muonium ($Mu^0$) Formation & $\mu$SR Asymmetry
This is where you connect to the experiment. In $\mu$SR, if the muon captures an electron to form a neutral $Mu^0$ atom, it forms a strongly coupled spin-triplet/singlet state. This drastically alters the muon spin precession, often resulting in a "missing fraction" in the asymmetry signal or specific characteristic frequencies.

To prove computationally whether $Mu^0$ forms:
1. **Calculate the Neutral State:** For your most stable $\mu^+$ sites (both pristine and trapped), run a calculation with a net charge of **0** (`NELECT` = default) and `ISPIN = 2` (or non-collinear spin if using SOC).
2. **The Spin Density Test:** Check the `CHGCAR_mag` (spin density) output.
    - **Scenario A (Shallow Donor):** If the extra electron delocalizes into the $MAPbI_3$ conduction band (spreading across the Pb-I framework), the state is technically $\mu^+ + e^-$. No Muonium is formed.
    - **Scenario B (Deep Bound State):** If the spin density shows exactly **1.0 $\mu_B$** strongly localized in a spherical $1s$-like orbital around the muon nucleus, a true $Mu^0$ has formed.
3. **Thermodynamic Transition:** Calculate the $(+/0)$ charge transition level for the muon. If this level lies deep within the $MAPbI_3$ bandgap, $Mu^0$ is a stable thermodynamic state when the Fermi level is high (n-type conditions).