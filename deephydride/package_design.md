Hi, I'm running comprehensive test calculations using this package to ensure it works as expected. Could you please review files in the engines folder and DeepHydride class so that all simulations including single calculations (eg elastic properties at specific hydrogen loading) and complex workflow (PCT calculation, thermal conductivity from scratch) can run correctly without error?

The code should now easy to use through the Hydride interface, project folder that stores everything for a simulation project, DeepHydride orchestrator that drives engines and workflows to run calculations and analysis code to get the target properties, visualisations for Hydride.

If the project folder is empty or doesn't exist, create blank project and allow user to set up calculations later.

For workflow calculations, DeepHydride should either uses calculation engine within engines folder or it runs a series of calculations and pulls the simulation results and extract the properties as implemented in files in workflow folder.

Please prepare example calculation scripts in the examples folder for individual properties listed below:

- elastc properties
- diffusivity as a function of hydrogen loading and temperature by run unified_md simulations
- comprehensive thermal conductivity study
- PCT and thermodynamic properties, enthalpy and entropy of dehydrogenation and hydrogenation (as we calculated hysteresis, we should be able to plot desorption and absorption vant hoff and therefore distinguish the desorption and absorption enthalpy/entropy), max capacity, slope, hysteresis etc.






```
project folder

calculations: unified_md, PCT, elastic_properties
properties: thermal conducvitity, diffusivity, capacity, desorption enthalpy, entropy, critical temperature, room temperature pleateau pressure, 