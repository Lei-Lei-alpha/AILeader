# LAMMPS-MACE interface on Ada

## Modules to load
```Shell
module use /software/easybuild-ada-uon/modules/all
module load lmod
module load zlib/1.2.12-GCCcore-11.3.0
module load binutils/2.38-GCCcore-11.3.0
module load gcc-uoneasy/11.3.0
module load bzip2/1.0.8-GCCcore-11.3.0
module load libreadline/8.1.2-GCCcore-11.3.0
module load GCCcore/11.3.0
module load ncurses/6.3-GCCcore-11.3.0
module load Tcl/8.6.12-GCCcore-11.3.0
module load SQLite/3.38.3-GCCcore-11.3.0
module load XZ/5.2.5-GCCcore-11.3.0
module load GMP/6.2.1-GCCcore-11.3.0
module load libffi/3.4.2-GCCcore-11.3.0
module load OpenSSL/1.1
module load Python/3.10.4-GCCcore-11.3.0
module load GCC/11.3.0
module load numactl/2.0.14-GCCcore-11.3.0
module load libxml2/2.9.13-GCCcore-11.3.0
module load libpciaccess/0.16-GCCcore-11.3.0
module load hwloc/2.7.1-GCCcore-11.3.0
module load libevent/2.1.12-GCCcore-11.3.0
module load UCX/1.15.0-GCCcore-11.3.0
module load GDRCopy/2.3-GCCcore-11.3.0
module load UCX-CUDA/1.15.0-GCCcore-11.3.0-CUDA-12.4.0
module load libfabric/1.15.1-GCCcore-11.3.0
module load PMIx/4.1.2-GCCcore-11.3.0
module load UCC/1.2.0-GCCcore-11.3.0
module load OpenMPI/4.1.4-GCC-11.3.0-UCX-1.15.0-CUDA-12.4.0
module load cURL/7.83.0-GCCcore-11.3.0
module load libarchive/3.6.1-GCCcore-11.3.0
module load CMake/3.24.3-GCCcore-11.3.0
module load CUDA/12.4.0
export LD_LIBRARY_PATH="/gpfs01/software/easybuild-ada-uon/software/CUDA/12.4.0/stubs/lib64:$LD_LIBRARY_PATH"
export LD_LIBRARY_PATH="$HOME/.local/lib/python3.10/site-packages/nvidia/nvjitlink/lib:$LD_LIBRARY_PATH"
```

## Download LAMMPS
```shell
git clone https://github.com/lammps/lammps.git
cd lammps
mkdir build
cd build
```

## Create `build_lammps.sh`

```shell
#!/bin/bash

# Auto-detect Python paths based on the currently loaded modules
export PYEXE=$(which python3)
export PYINC=$(python3 -c "import sysconfig; print(sysconfig.get_path('include'))")
export NPINC=$(python3 -c "import numpy; print(numpy.get_include())")

echo "Using Python: $PYEXE"
echo "Using PyInclude: $PYINC"
echo "Using NumPy: $NPINC"

cmake -C ../cmake/presets/kokkos-cuda.cmake \
  -D CMAKE_BUILD_TYPE=Release \
  -D CMAKE_INSTALL_PREFIX=$(pwd)/install \
  -D BUILD_MPI=ON \
  -D BUILD_SHARED_LIBS=ON \
  -D PKG_ML-IAP=ON \
  -D PKG_ML-SNAP=ON \
  -D MLIAP_ENABLE_PYTHON=ON \
  -D PKG_PYTHON=ON \
  -D PKG_MC=ON \
  -D PKG_EXTRA-FIX=ON \
  -D Kokkos_ARCH_ZEN3=ON \
  -D Kokkos_ARCH_AMPERE80=ON \
  -D Kokkos_ENABLE_CUDA=ON \
  -D Kokkos_ENABLE_OPENMP=ON \
  -D Python3_EXECUTABLE="$PYEXE" \
  -D Python3_INCLUDE_DIR="$PYINC" \
  -D Python3_NumPy_INCLUDE_DIR="$NPINC" \
  ../cmake

```

Run the above `build_lammps.sh` script:
```shell
bash build_lammps.sh
```
## Build & install
```shell
make -j 16
make install
```

To verify the installation:
```shell
./install/bin/lmp -h | grep -i mliap
```
Should see ML-IAP listed.

