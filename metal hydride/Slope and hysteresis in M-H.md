## **Speaker Notes**

**Slide 1: Thermodynamic Analysis: The Plateau Slope Paradox**

- **Opening:** "Welcome, everyone. Today we are looking at the thermodynamic modeling of complex metal-hydrogen systems. We begin with a fundamental paradox rooted in the Gibbs Phase Rule."
    
- **The Paradox:** "For a binary metal-hydrogen system forming two solid phases and one gas phase at a constant temperature, the degrees of freedom evaluate to exactly zero. Thermodynamically, this mandates a perfectly horizontal equilibrium pressure plateau. Yet, in real, complex intermetallics like AB2-type alloys, we routinely observe sloped plateaus and hysteresis."
    
- **The Physical Reality:** "To resolve this, we must recognize that we are violating the strict two-component assumption. Chemical disorder creates a spectrum of local environments and site enthalpies. Furthermore, the lattice mismatch between the alpha and beta phases introduces coherent elastic strain. Finally, the massive volume expansion—often 10 to 25 percent—forces the host lattice to plastically yield, which manifests macroscopically as hysteresis."
    

**Slide 2: Flanagan & Lototsky (Statistical Inhomogeneity)**

- **Historical Context:** "One of the earliest attempts to model this was by Flanagan and Lototsky, focusing on statistical inhomogeneity."
    
- **The Mechanism:** "They proposed that the plateau slope is extrinsic—arising from a Gaussian distribution of local, ideal plateaus driven by micro-segregation. Hysteresis, in their model, is explicitly linked to the plastic deformation required to accommodate the expanding hydride."
    
- **Temperature Dependence:** "A key takeaway from this model is the thermal behavior. As temperature increases, the yield strength of the metal drops, causing the hysteresis gap to shrink. However, the variance governing the slope is treated as largely temperature-independent."
    

**Slide 3: Schwarz-Khachaturyan (Coherent Elasticity)**

- **A Different Approach:** "In contrast, Schwarz and Khachaturyan modeled the slope as an intrinsic property driven by coherent elasticity."
    
- **The Mechanism:** "Here, the slope emerges from long-range elastic interactions between hydrogen atoms occupying a continuous, coherent lattice. The hysteresis gap represents the energy penalty of losing that coherency—specifically, the energy dissipated through dislocation punch-out when the lattice finally relaxes."
    
- **Temperature Dependence:** "Mathematically, the elastic energy term is normalized by RT. This strictly dictates that both the slope and the hysteresis gap scale inversely with temperature, vanishing completely as thermal energy overwhelms the elastic interactions near the critical temperature."
    

**Slide 4: Lexcellent & Gondor (Thermomechanical)**

- **Continuum Mechanics:** "Lexcellent and Gondor bridged phase transformation theory with elastoplasticity to create a continuum thermomechanical model."
    
- **The Mechanism:** "They defined the slope using a macroscopic elastic hardening parameter, A, derived from Eshelby inclusion theory. Hysteresis is represented by a friction threshold, k, for non-recoverable plastic work."
    
- **The Limitation:** "While the mechanical softening aspect works well for modeling the vanishing hysteresis at higher temperatures, there is a theoretical conflict. True elasticity requires A to be positive, which mathematically results in flat hysteretic loops. Forcing A to be negative to match experimental sloped plateaus breaks the underlying physical derivation."
    

**Slide 5: Gibbs Variance Model (High-Entropy Alloys)**

- **Modern Complex Alloys:** "Moving to highly disordered systems like High-Entropy Alloys, we turn to the Gibbs Variance Model, which utilizes first-principles statistical mechanics."
    
- **The Mechanism:** "This model tilts the plateau by recognizing that hydrogen atoms sequentially fill a broad distribution of site energies while navigating topological jamming. The slope is a function of both enthalpic variance (σH​) and entropic variance (σS​)."
    
- **The HEA Signature:** "The temperature dependence here is unique and serves as a signature of High-Entropy Alloys. At low temperatures, thermal energy smooths the enthalpic landscape, so the slope decreases as temperature rises. However, at high temperatures, the enthalpic effects wash out, revealing a constant 'Entropic Floor.' Here, thermal energy actually amplifies site-blocking effects, causing the slope to flatten out or even increase near the critical point."
    

**Slide 6: The LLL Synthesis**

- **Bringing It Together:** "To capture the full physical picture without the limitations of purely empirical fitting, we synthesize these approaches into the Lacher-Lototsky-Lexcellent, or LLL, framework."
    
- **Decoupling the Physics:** "This framework mathematically decouples the first-order plastic strain from the local chemical landscape. The baseline equilibrium pressure—which dictates the sloped plateau and the rounded knees of the curve—is governed by the Lototsky chemical disorder and topological jamming. We then apply the Lexcellent macroscopic dissipative work to model the hysteresis gap."
    
- **The Impact:** "By isolating the mechanical penalty from the chemical equilibria, we can input modern first-principles data, like DFT or Machine Learning potentials, to accurately predict macroscopic isotherms."
    

**Slide 7: Plateau Slope: Statistical Variance Model**

- **Practical Calculation:** "Looking closely at the computational execution for the slope, we use a Root-Mean-Square summation of the localized disorder."
    
- **Enthalpic and Entropic Terms:** "The enthalpic variance is extracted from the standard deviation of our raw DFT configuration energies. Crucially, we apply a Boltzmann statistical weight to these energies. This physically ensures that highly unstable, thermodynamically inaccessible atomic configurations do not artificially broaden our predicted plateau. The entropic variance is then mapped via a polynomial to local configurational jamming constraints."
    

**Slide 8: Hysteresis: Macroscopic Dissipative Work**

- **Calculating the Gap:** "Finally, we evaluate the hysteresis using the Lexcellent mechanical yielding concept, scaled to the critical point."
    
- **Anchoring the Physics:** "We analytically derive the base dissipation at absolute zero (Ediss,0​) directly from the macroscopic shear modulus of the alloy and the phase volume mismatch. This anchors the physical size of the gap to the actual rigidity of the host metal."
    
- **Thermal Scaling:** "We then apply a continuum scaling factor—the square root of 1−T/Tc​. This captures the mechanical softening of the lattice and guarantees that the irreversible work smoothly and physically drops to zero exactly as the system enters the supercritical regime."