# Deployment Notes: Serving Gemma via Ollama in HPC User Space
Objective: Configure a local inference server to run the Gemma 2 model on an HPC compute node without root privileges, containerization modules, or system-wide daemon access, and establish a secure bridge for local client queries.

Phase 1: Software Download and Extraction
Due to older dependencies on standard HPC login nodes (specifically tar failing to parse Zstandard compression natively), the official Ollama Linux archive must be extracted using a two-step decompression process.

1. Download the Zstandard Archive
Retrieve the latest Linux release directly from the official repository:

```Bash
wget -O ~/ollama-linux-amd64.tar.zst https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst
```

2. Two-Step Decompression
Decompress the .zst file using the zstd utility, then extract the standard .tar archive into the user's local directory (~/.local is recommended as it natively aligns with Linux path conventions for user binaries).

```Bash
# Ensure the local directory exists
mkdir -p ~/.local

# If zstd is not recognized, load it via the cluster module system first:
# module load zstd

# Decompress into a standard tarball
zstd -d ~/ollama-linux-amd64.tar.zst

# Extract bin/ and lib/ directories into the local path
tar -xf ~/ollama-linux-amd64.tar -C ~/.local

# Remove large archive files to preserve storage quotas
rm ~/ollama-linux-amd64.tar ~/ollama-linux-amd64.tar.zst
```

3. Configure Environment Path
Ensure the system recognizes the executable. Append the path to the shell profile for persistence:

```Bash
export PATH=$HOME/.local/bin:$PATH
echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc
```

Verify execution:

```Bash
ollama -v
```

(Expected output: Client version warning, which confirms the binary is functional).

Phase 2: Compute Node Allocation and Serving
Inference requires GPU acceleration. A non-interactive Slurm batch script is utilized to start the server, route large model weights to scratch storage, download the model, and maintain the process for a sustained period.

1. Create the Batch Script
Create a file named serve_gemma.sh containing the requested resource parameters:

```Bash
#!/bin/bash
#SBATCH --partition=ampereq
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=1
#SBATCH --mem=64g
#SBATCH --time=7-00:00:00
#SBATCH --gres=gpu:1
#SBATCH --output=gemma_serve_%j.log

echo "====================================================="
echo "Gemma Server is running on compute node: $HOSTNAME"
echo "====================================================="

export PATH=$HOME/.local/bin:$PATH
export OLLAMA_MODELS=/scratch/$USER/ollama_models
export OLLAMA_HOST=0.0.0.0

echo "Initializing Ollama daemon..."
ollama serve &
OLLAMA_PID=$!

# Delay to allow network ports to bind
sleep 15

# Pull Gemma 2 (9B parameter formulation)
echo "Fetching Gemma 2 weights..."
ollama pull gemma2

echo "Deployment complete. Server is listening on port 11434."

# Maintain job execution state
wait $OLLAMA_PID
```

2. Submit the Job

```Bash
sbatch serve_gemma.sh
```

Phase 3: Client Connection Protocol
The local workstation acts strictly as a client sending API requests. No model weights are stored or processed locally.

1. Identify Assigned Hardware
Read the Slurm log file to identify the allocated compute node:

```Bash
cat gemma_serve_*.log
```
(Extract the hostname following "Gemma Server is running on compute node:")

2. Establish Secure Shell Tunnel
On the local workstation, execute port forwarding to bridge local port 11434 to the HPC compute node:

```Bash
ssh -N -L 11434:[COMPUTE_NODE_HOSTNAME]:11434 username@hpc.university.edu
```
3. Execute Query
The model is now accessible via standard local HTTP requests or GUI frontends:

```Bash
curl http://localhost:11434/api/generate -d '{
  "model": "gemma4:31b",
  "prompt": "Detail the architectural differences between transformers and state space models.",
  "stream": false
}'
```