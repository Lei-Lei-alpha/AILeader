# Ada job submission scripts

## CPU jobs

```Shell
#!/bin/bash -l
#SBATCH --qos=costed
#SBATCH --partition=defq
#SBATCH --job-name=VASP
#SBATCH --nodes=6
#SBATCH --ntasks-per-node=96
#SBATCH --cpus-per-task=1
#SBATCH --time=12:00:00

module use /gpfs01/software/CSHSM/vasp/src/vasp.6.4.2-foss-2023.09-build/modulefiles
module load vasp/6.4.2-foss-2023.09
export OMP_NUM_THREADS=1
export SLURM_SUBMIT_DIR=$(readlink -f $SLURM_SUBMIT_DIR)
cd $SLURM_SUBMIT_DIR
mpirun vasp_std > vasp.log
```

## VASP with ASE

## Gemma