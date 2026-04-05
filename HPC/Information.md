# Information for HPCs currently using
## Sulis
### VASP
```Shell
export OMP_NUM_THREADS=1
export MKL_DEBUG_CPU_TYPE=5
export MKL_CBWR=COMPATIBLE
export LD_LIBRARY_PATH=/sulis/easybuild/software/imkl/2019.5.281-gompi-2019b/mkl/lib/intel64:$LD_LIBRARY_PATH

export VASP_PP_PATH="/home/l/leilei/chemsoft/vasp"
export VASP_COMMAND="srun --distribution=block:block --hint=nomultithread /home/l/leilei/bin/vasp/vasp_std"
```
