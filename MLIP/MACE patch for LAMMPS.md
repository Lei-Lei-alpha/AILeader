# Patch Notes: MACE LAMMPS ML-IAP Wrapper (`lammps_mliap_mace.py`)

## Issue Description
When executing standard metallic alloy or non-magnetic models using the MACE ML-IAP unified interface in LAMMPS, the Python wrapper crashes during the initial force calculation (Step 0 of the Verlet integration). The traceback indicates an `AttributeError`.

This occurs because the MACE LAMMPS calculator blindly attempts to access `total_charge` and `total_spin` attributes from the loaded PyTorch model (`.pt` file). If the model was not explicitly trained with these parameters (which is standard for non-ionic, non-magnetic systems), the attributes do not exist, causing the forward pass to fail.

## File Modified
`~/.local/lib/python3.10/site-packages/mace/calculators/lammps_mliap_mace.py`

## Code Modifications
The fix introduces Python's `getattr()` function to safely query the PyTorch model object. If the attributes are missing, it provides physically appropriate fallback defaults (`0.0` for charge, `None` for spin) rather than crashing.

### 1. Resolving `total_charge` (Approx. Line 95)
**Original Code:**
```python
data["total_charge"] = self.total_charge
```
**Patched Code:**
```Python
data["total_charge"] = getattr(self, "total_charge", 0.0)
```
## 2. Resolving `total_spin` (Approx. Line 96)

**Original Code:**
```Python
data["total_spin"] = self.total_spin
```
**Patched Code:**
```Python
data["total_spin"] = getattr(self, "total_spin", None)
```

## Patch total_charge missing attribute

```shell
sed -i 's/data\["total_charge"\] = self.total_charge/data\["total_charge"\] = getattr(self, "total_charge", 0.0)/g' ~/.local/lib/python3.10/site-packages/mace/calculators/lammps_mliap_mace.py
```
## Patch total_spin missing attribute
```Shell
sed -i 's/data\["total_spin"\] = self.total_spin/data\["total_spin"\] = getattr(self, "total_spin", None)/g' ~/.local/lib/python3.10/site-packages/mace/calculators/lammps_mliap_mace.py
```