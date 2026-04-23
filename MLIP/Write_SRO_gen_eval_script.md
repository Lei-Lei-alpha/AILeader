# Implementation Guide: Batched NVT-MC for SRO Generation via ML Potentials
## Objective: To accurately sample Short-Range Order (SRO) in an alloy system with large atomic size mismatch.
## Methodology: A "Pure ASE" coupled with PyTorch approach.
This bypasses traditional MD engines (like LAMMPS) to execute a rigorously relaxed Metropolis-Hastings Monte Carlo loop. To maximize GPU utilization without violating the Markov Chain property, the workflow employs a Multiple Independent Walkers architecture.
1. System Initialization. Before entering the thermodynamic sampling loop, establish the baseline states. 
    - Generate Initial Structure: Create the starting Special Quasi-random Structure (SQS) or a randomly substituted structure to ensure the macroscopic stoichiometry is exactly matching the target concentration.
    - Global Relaxation: Optimize this initial SQS using the MACE calculator via ASE to find the $0 \text{ K}$ ground state configuration for the unperturbed lattice. Record this baseline energy.
    - Instantiate Walkers: Duplicate the globally relaxed SQS into a batch of $W$ identical replicas (e.g., $W = 1000$). These represent independent parallel MC chains (Walkers).
2. The Batched MC Loop: "Swap $\rightarrow$ Relax $\rightarrow$ Decide". This phase executes the core thermodynamic sampling. For every step in the Monte Carlo trajectory, execute the following batched sequence across all Walkers simultaneously.
    - Parallel Proposal GenerationFor each independent Walker ($w_i$), randomly select one pair of dissimilar atoms.Manually swap their atomic positions or elemental types within the ASE Atoms object.Constraint: Propose exactly one unique swap per Walker. Do not propose multiple swaps on a single Walker, as this violates detailed balance if evaluated simultaneously.
    - Batched Local Relaxation (GPU Acceleration)Gather the $W$ newly swapped, unrelaxed structures.Pass the entire batch of structures into the TorchSim / MACE interface for a parallelized local structural minimization.This step relieves the severe elastic strain caused by forcing a large atom into a small site (the 1.233 mismatch).Extract the array of relaxed energies: $E_{relaxed\_new}^{(i)}$ for each Walker $i$.
    - Metropolis-Hastings EvaluationFor each Walker independently, calculate the acceptance probability $P_{acc}^{(i)}$ using the relaxed energies:

    $$P_{acc}^{(i)} = \min \left( 1, \exp\left( -\frac{E_{relaxed\_new}^{(i)} - E_{old}^{(i)}}{k_B T} \right) \right)$$
    
    Generate a uniform random number $\eta_i \in [0, 1]$.
    
    Acceptance: If $\eta_i < P_{acc}^{(i)}$, the swap is successful.  
    Rejection: If $\eta_i \geq P_{acc}^{(i)}$, the swap fails. 
    - State Update. If Accepted: The Walker's current state is updated to the new, relaxed coordinates and $E_{old}^{(i)}$ becomes $E_{relaxed\_new}^{(i)}$. If Rejected: Discard the relaxed structure and revert the Walker entirely to its previous saved coordinate state and energy.
## Algorithmic Justification
Architecture ChoicePhysical/Computational RationaleLocal Relaxation Prior to EvaluationEssential for the 1.233 size ratio. Evaluating a static lattice yields massive steric overlap energies, driving swap acceptance to near-zero. Relaxation captures true configurational energy by including elastic strain relief.Pure ASE/Python Route (No LAMMPS)Provides direct, elegant programmatic control over the swap logic and integrates seamlessly with modern ML potential ecosystem (MACE/PyTorch) without complex I/O overhead or text-based scripting.Multiple Independent WalkersReconciles GPU batch-processing with the Markov property. Batch-evaluating multiple swaps on a single structure is thermodynamically invalid because accepting one swap invalidates the strain fields (and energies) of all other concurrent proposals. Independent walkers advance thousands of valid trajectories simultaneously without wasted computation.