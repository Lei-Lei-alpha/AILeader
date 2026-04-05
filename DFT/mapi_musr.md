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


## Unified Workflow Script

```Python
import argparse
import sys
import os
import glob
from pathlib import Path
from ase.io import read
from ase.db import connect
from ase.calculators.vasp import Vasp

def get_calculator_settings(step, run_dir):
    """Returns the appropriate VASP INCAR parameters based on the workflow step."""
    
    # --- Universal Base Settings for MAPbI3 ---
    base_params = {
        'directory': run_dir,
        'xc': 'PBE',
        'ivdw': 11,             # DFT-D3 for MA molecules
        'encut': 500,
        'algo': 'Normal',
        'lreal': 'Auto',        # Efficient for large supercells
        'sigma': 0.05,
        'kspacing': 0.25,       # Appropriate for 2x2x2 supercell
        'kgamma': True,
        'npar': 4,              # Adjust based on your HPC node architecture
        'kpar': 2,
    }

    if step == 'pristine_relax':
        # Step 1: Relaxing the bulk pristine supercell (Volume + Ions)
        step_params = {
            'system': 'MAPbI3_Pristine_Relax',
            'prec': 'Accurate',
            'ediff': 1e-5,
            'isif': 3,          # Relax volume, cell shape, and internal ions
            'ibrion': 2,        # Conjugate Gradient
            'nsw': 100,
            'ediffg': -0.02,    # Force convergence criteria (eV/A)
            'ismear': 0,        # Gaussian smearing
            'ispin': 1,         # Non-magnetic bulk
            'lwave': False,
            'lcharg': False
        }

    elif step == 'defect_relax':
        # Step 2: Relaxing the defect/muon (Constant Volume, Ions Only)
        step_params = {
            'system': 'MAPbI3_Defect_Relax',
            'prec': 'Accurate',
            'ediff': 1e-5,
            'isif': 2,          # Constant volume (crucial for dilute defects)
            'ibrion': 2,
            'nsw': 100,
            'ediffg': -0.02,
            'ismear': 0,
            'ispin': 2,         # Turn on spin-polarization for defects/muon
            'lwave': True,      # Save WAVECAR to speed up the SOC step
            'lcharg': False
        }

    elif step == 'static_soc':
        # Step 3: Electronic Structure & Spin Density (Static, SOC enabled)
        step_params = {
            'system': 'MAPbI3_Defect_Static_SOC',
            'prec': 'Accurate',
            'ediff': 1e-6,      # Tighter electronic convergence required
            'isif': 2,
            'ibrion': -1,       # Static calculation (no ion movement)
            'nsw': 0,
            'ismear': 0,        # Use 0 for large supercells (Gamma only). Use -5 if k-mesh > 4.
            'lsorbit': True,    # Turn on Spin-Orbit Coupling
            'lnoncollinear': True,
            'isym': 0,          # Symmetry MUST be off for SOC defects
            'lorbit': 11,       # Write PROCAR for orbital/spin analysis
            'lvtot': True,      # Write LOCPOT for FNV finite-size corrections
            'lwave': False,
            'lcharg': True      # Keep CHGCAR for Muonium spin density check
            # NOTE: If reading from defect_relax, add 'istart': 1 to read WAVECAR
        }
    else:
        raise ValueError(f"Unknown workflow step: {step}")

    # Merge base parameters with step-specific parameters
    return {**base_params, **step_params}


def main():
    parser = argparse.ArgumentParser(description="Multi-step VASP workflow for MAPbI3 Muon/Defect calculations.")
    parser.add_argument("-d", "--dir", required=True, help="Path to structures.")
    parser.add_argument("-db", "--database", default="workflow_checkpoint.db", help="ASE database file.")
    parser.add_argument("-s", "--step", required=True, 
                        choices=['pristine_relax', 'defect_relax', 'static_soc'],
                        help="Select which step of the workflow to execute.")
    args = parser.parse_args()

    input_dir = args.dir
    db_path = args.database
    current_step = args.step

    if not os.path.isdir(input_dir):
        print(f"Error: Directory '{input_dir}' not found.")
        sys.exit(1)

    db = connect(db_path)
    print(f"Starting Workflow Step: [{current_step.upper()}] in {input_dir}")

    structure_files = []
    for pattern in ['*.vasp', '*.traj', '*.cif', 'POSCAR*']:
        structure_files.extend(glob.glob(os.path.join(input_dir, pattern)))

    if not structure_files:
        print("No structure files found.")
        sys.exit(0)

    for filepath in structure_files:
        filename = os.path.basename(filepath)
        atoms = read(filepath)
        formula = atoms.get_chemical_formula()
        
        # Checkpoint identifier incorporates both filename and the requested step
        run_id = f"{filename}_{current_step}"
        
        existing_rows = list(db.select(run_id=run_id))
        if existing_rows:
            row = existing_rows[0]
            if row.get('computed', False):
                print(f"Skipping {filename} - {current_step} already computed.")
                continue
            else:
                db_id = row.id
        else:
            db_id = db.write(atoms, run_id=run_id, computed=False)

        print(f"\n--- Processing: {filename} ({current_step}) ---")

        run_dir = f"vasp_{current_step}_{Path(filename).stem}_{db_id}"
        os.makedirs(run_dir, exist_ok=True)

        # Retrieve mapped INCAR settings
        calc_settings = get_calculator_settings(current_step, run_dir)
        calc = Vasp(**calc_settings)
        atoms.calc = calc

        try:
            atoms.get_potential_energy()
            
            # Validation logic depends on the step
            outcar_path = os.path.join(run_dir, 'OUTCAR')
            if os.path.exists(outcar_path):
                with open(outcar_path, 'r') as f:
                    outcar_text = f.read()
                
                # Check for standard VASP termination
                if "General timing and accounting informations" in outcar_text:
                    
                    # Extra validation for static_soc to ensure LOCPOT was written
                    if current_step == 'static_soc':
                        locpot_path = os.path.join(run_dir, 'LOCPOT')
                        if not (os.path.exists(locpot_path) and os.path.getsize(locpot_path) > 0):
                            print(f"Warning: VASP terminated, but LOCPOT is missing for {filename}.")
                            continue

                    db.update(db_id, computed=True)
                    print(f"Success! {current_step} completed for {filename}. DB updated.")
                else:
                    print(f"Warning: VASP did not terminate cleanly for {filename}.")
            else:
                print(f"Error: OUTCAR missing for {filename}.")
                
        except Exception as e:
            print(f"Critical failure for {filename}: {e}")

if __name__ == "__main__":
    main()
```

## Calculation notes

### 1. Pristine Structure Relaxation

### 2. Defect Structure Relaxation

### 3. Static SOC Calculation

### 4. Charge Transition Level Calculation

### 5. Muonium Formation Test