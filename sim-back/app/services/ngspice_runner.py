# sim-back/app/services/run_ngspice.py
import os
import re
import shlex
import shutil
import subprocess
import tempfile
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ----------------------------
# Helpers
# ----------------------------

def _normalize_analysis_type(analysis_type: str) -> str:
    return (analysis_type or "").strip().lower()


# def _find_ngspice_executable() -> Optional[str]:
#     """
#     Try common executable names across platforms.
#     - Linux often has: ngspice
#     - Some installs / Windows builds: ngspice_con
#     """
#     for name in ("ngspice", "ngspice_con"):
#         path = shutil.which(name)
#         if path:
#             return name
#     return None

def _find_ngspice_executable() -> str | None:
    # Prefer ngspice_con
    if shutil.which("ngspice_con"):
        return "ngspice_con"
    # Optional fallback (remove this block if you want STRICT ngspice_con only)
    if shutil.which("ngspice"):
        return "ngspice"
    return None



def _extract_wrdata_vars(netlist: str) -> Tuple[Optional[str], List[str]]:
    """
    Extract WRDATA output filename and variables from netlist.

    Accepts variations like:
      wrdata out.csv v(n1) v(n2)
      WRDATA "out.csv" v(n1) v(n2)
      wrdata out.csv V(n1) V(n2)

    Returns: (filename, [var1, var2, ...])
    """
    out_file = None
    vars_ = []

    for raw_line in netlist.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        # ignore comments
        if line.startswith("*") or line.startswith(";"):
            continue

        if line.lower().startswith("wrdata "):
            # use shlex to handle quoted filenames
            try:
                parts = shlex.split(line)
            except ValueError:
                parts = line.split()

            # parts[0] = wrdata, parts[1] = out.csv, parts[2:] = vars
            if len(parts) >= 2:
                out_file = parts[1]
            if len(parts) >= 3:
                vars_ = parts[2:]
            break

    return out_file, vars_


def _split_row(line: str) -> List[str]:
    """
    Handle either comma-separated or whitespace-separated.
    """
    return line.strip().replace(",", " ").split()


# ----------------------------
# Main runner
# ----------------------------

def run_ngspice(netlist: str, analysis_type: str, timeout_s: int = 30) -> Dict[str, Any]:
    """
    Run ngspice (or ngspice_con) in batch mode on the given netlist.

    Returns:
      For OP:
        { ok, analysis:"op", op:{nodeVoltages:{}}, warnings:[], raw:"..." }
      For TRAN:
        { ok, analysis:"tran", tran:{time:[], series:{}}, warnings:[], raw:"..." }
      For errors:
        { ok:false, errors:[...], raw:"..." }
    """
    analysis_type = _normalize_analysis_type(analysis_type)

    exe = _find_ngspice_executable()
    if not exe:
        return {
            "ok": False,
            "errors": [
                "ngspice executable not found in PATH. Install ngspice or add it to PATH "
                "(tried: ngspice, ngspice_con)."
            ],
            "raw": "",
        }

    with tempfile.TemporaryDirectory() as temp_dir:
        netlist_path = os.path.join(temp_dir, "circuit.cir")

        with open(netlist_path, "w", encoding="utf-8") as f:
            f.write(netlist)

        cmd = [exe, "-b", netlist_path]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=temp_dir,
                timeout=timeout_s,
            )
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "errors": [f"Simulation timed out after {timeout_s}s"],
                "raw": "",
            }
        except Exception as e:
            return {"ok": False, "errors": [str(e)], "raw": ""}

        raw_output = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
        if result.returncode != 0:
            return {
                "ok": False,
                "errors": [f"{exe} exited with code {result.returncode}"],
                "raw": raw_output,
            }

        if analysis_type == "tran":
            return _parse_tran_results(temp_dir, raw_output, netlist)

        if analysis_type == "op":
            return _parse_op_wrdata_results(temp_dir, raw_output, netlist)

        return {
            "ok": False,
            "errors": [f"Unknown analysis type: {analysis_type}"],
            "raw": raw_output,
        }


# ----------------------------
# TRAN parsing (wrdata -> out.csv)
# ----------------------------

def _detect_tran_column_offset(vals: List[float], num_vars: int) -> int:
    """
    Auto-detect where the actual data columns start in ngspice wrdata output.

    ngspice wrdata can produce different column layouts:
      Case A: time  v(n1)  v(n2)  ...         -> data starts at col 1
      Case B: time  time  v(n1)  v(n2)  ...   -> data starts at col 2 (duplicate time)
      Case C: index time  v(n1)  v(n2)  ...   -> data starts at col 2 (index column)

    Detection heuristics:
      1. If col[1] ≈ col[0] (within small epsilon), assume duplicate time -> data starts at col 2
      2. If col[0] looks like integer index (0,1,2...) and col[1] is time-like -> data starts at col 2
      3. Otherwise assume standard layout -> data starts at col 1

    Args:
        vals: First numeric row parsed as floats
        num_vars: Number of variables expected (from wrdata command)

    Returns:
        Column index where data starts (1 or 2)
    """
    if len(vals) < 2:
        return 1  # Fallback to standard layout

    col0 = vals[0]
    col1 = vals[1]

    # Heuristic 1: Duplicate time column
    # If col[0] and col[1] are very close (within 1e-12), assume duplicate time
    if abs(col1 - col0) < 1e-12:
        # print(f"DETECTION: Duplicate time column detected: col[0]={col0}, col[1]={col1}")
        return 2

    # Heuristic 2: Index column
    # If col[0] is very small (likely index 0 or close to 0) and is an integer-like value
    # and col[1] is different (likely actual time), assume index column
    if abs(col0 - round(col0)) < 1e-9 and col0 < 10:  # col0 is integer-like and small
        # Also check if we have enough columns for index + time + vars
        expected_cols = 1 + 1 + num_vars  # index + time + data
        if len(vals) >= expected_cols:
            # print(f"DETECTION: Index column detected: col[0]={col0} (index), col[1]={col1} (time)")
            return 2

    # Standard layout: time v1 v2 v3...
    # print(f"DETECTION: Standard layout detected: col[0]={col0} (time)")
    return 1


def _parse_tran_results(temp_dir: str, raw_output: str, netlist: str) -> Dict[str, Any]:
    """
    Reads out.csv generated by a 'wrdata' command in the netlist.

    Expected typical wrdata output:
      t  v(n1)  v(n2)  ...
    i.e. columns: time, then one value per requested variable.

    IMPORTANT: ngspice wrdata can output extra columns depending on build/version:
      - time  time  v(n1)  v(n2)  ...   (duplicate time)
      - index time  v(n1)  v(n2)  ...   (index column)

    We auto-detect the column offset to handle these variations.
    """
    warnings: List[str] = []

    out_file, var_names = _extract_wrdata_vars(netlist)
    if not out_file:
        return {
            "ok": False,
            "errors": ["No wrdata command found in netlist; cannot locate transient CSV output."],
            "raw": raw_output,
        }

    csv_path = os.path.join(temp_dir, out_file)
    if not os.path.exists(csv_path):
        # Include snippet of raw output to help debug why file wasn't written
        raw_snippet = "\n".join(raw_output.splitlines()[:10])
        return {
            "ok": False,
            "errors": [
                f"Output file not found: {out_file}. Did ngspice write it?",
                f"Ngspice output snippet:\n{raw_snippet}"
            ],
            "raw": raw_output,
        }

    data = {"time": [], "series": {name: [] for name in var_names}}

    # Auto-detect column offset from first valid row
    data_start_col = None  # Will be set after detecting offset

    try:
        with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
            lines_list = f.readlines()

        for line in lines_list:
            row = line.strip()
            if not row:
                continue

            parts = _split_row(row)
            if len(parts) < 2:
                continue

            # Try to parse as numeric row
            try:
                vals = [float(p) for p in parts]
            except ValueError:
                # header / malformed line
                continue

            # Auto-detect column layout on first valid numeric row
            if data_start_col is None:
                data_start_col = _detect_tran_column_offset(vals, len(var_names))
                # print(f"Detected transient data start column: {data_start_col}")

            # Extract time (always from first column in alternating format)
            t = vals[0]
            data["time"].append(t)

            # ngspice wrdata uses alternating format: time var1 time var2 time var3
            # So variable i is at index: 1 + (i * 2)
            # var[0] at index 1, var[1] at index 3, var[2] at index 5, etc.
            for i, name in enumerate(var_names):
                val_idx = 1 + (i * 2)
                if val_idx < len(vals):
                    data["series"][name].append(vals[val_idx])
                else:
                    # missing column -> keep lengths aligned
                    data["series"][name].append(float("nan"))

        # basic sanity
        n = len(data["time"])
        for name in var_names:
            if len(data["series"][name]) != n:
                warnings.append(
                    f"Series length mismatch for {name}: {len(data['series'][name])} vs time {n}."
                )

        return {
            "ok": True,
            "analysis": "tran",
            "tran": data,
            "warnings": warnings,
            "raw": raw_output,
        }

    except Exception as e:
        return {
            "ok": False,
            "errors": [f"Error parsing transient output {out_file}: {str(e)}"],
            "raw": raw_output,
        }


# ----------------------------
# OP parsing (wrdata -> out_op.csv)
# ----------------------------

def _parse_op_wrdata_results(temp_dir: str, raw_output: str, netlist: str) -> Dict[str, Any]:
    """
    Parse node voltages and currents from 'wrdata' CSV output for DC (.op).
    
    Returns structured JSON:
      {
        "nodeVoltages": [{"node": "n1", "voltage": 5.0}, ...],
        "elementCurrents": [{"element": "R1", "current": 0.002}, ...]
      }
    """
    out_file, var_names = _extract_wrdata_vars(netlist)
    if not out_file:
         return {
            "ok": False,
            "errors": ["No wrdata command found in netlist for OP analysis."],
            "raw": raw_output,
        }
    
    csv_path = os.path.join(temp_dir, out_file)
    if not os.path.exists(csv_path):
        # Include snippet of raw output
        raw_snippet = "\n".join(raw_output.splitlines()[:20])
        return {
            "ok": False,
            "errors": [
                f"OP output file not found: {out_file}. Did ngspice write it?",
                f"Ngspice output snippet:\n{raw_snippet}"
            ],
            "raw": raw_output,
        }

    last_vals: List[float] = []
    
    try:
        with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                parts = _split_row(line)
                if not parts:
                    continue
                try:
                    vals = [float(p) for p in parts]
                    last_vals = vals
                except ValueError:
                    continue
    except Exception as e:
        return {
            "ok": False,
            "errors": [f"Error parsing OP output: {str(e)}"],
            "raw": raw_output,
        }

    if not last_vals:
         return {
            "ok": False,
            "errors": ["OP output file is empty."],
            "raw": raw_output,
        }

    # Extract values assuming alternating format: scale val1 scale val2 ...
    node_voltages = []
    element_currents = []

    for i, name in enumerate(var_names):
        val_idx = 1 + (i * 2)
        if val_idx < len(last_vals):
            val = last_vals[val_idx]
            
            # Clean name logic
            clean_name = name
            is_current = False
            
            # Remove v() or i() wrapper
            if name.lower().startswith("v(") and name.endswith(")"):
                clean_name = name[2:-1]
            elif name.lower().startswith("i(") and name.endswith(")"):
                clean_name = name[2:-1]
                is_current = True
            elif name.startswith("@") and name.endswith("[i]"):
                clean_name = name[1:-3].upper()
                is_current = True
            
            if is_current:
                element_currents.append({"element": clean_name, "current": val})
            else:
                node_voltages.append({"node": clean_name, "voltage": val})

    return {
        "ok": True,
        "analysis": "op",
        "dc": {
            "nodeVoltages": node_voltages,
            "elementCurrents": element_currents
        },
        "raw": raw_output
    }



# ----------------------------
# OP parsing (stdout)
# ----------------------------

_OP_TABLE_HEADER_RE = re.compile(r"^\s*Node\s+Voltage\b", re.IGNORECASE)
_OP_TABLE_ROW_RE = re.compile(r"^\s*([A-Za-z0-9_().:+\-]+)\s+([+\-]?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)\s*$")
_V_ASSIGN_RE = re.compile(r"v\(\s*([^)]+)\s*\)\s*=\s*([+\-]?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)", re.IGNORECASE)


def _parse_op_results(raw_output: str) -> Dict[str, Any]:
    """
    Parse node voltages from ngspice stdout.

    Handles:
    - "Node Voltage" table format
    - fallback "v(n1) = 5.0" style if present

    NOTE: OP output formatting varies by version and by netlist control commands.
    If you want maximum reliability, ensure your OP netlist includes:
      .control
      op
      print allv
      quit
      .endc
    """
    node_voltages: Dict[str, float] = {}
    warnings: List[str] = []

    lines = raw_output.splitlines()

    # Try table capture
    capture = False
    for line in lines:
        l = line.strip()
        if not capture and _OP_TABLE_HEADER_RE.match(l):
            capture = True
            continue
        if capture:
            if not l:
                capture = False
                continue
            if l.startswith("----"):
                continue
            m = _OP_TABLE_ROW_RE.match(l)
            if m:
                node = m.group(1)
                try:
                    node_voltages[node] = float(m.group(2))
                except ValueError:
                    pass

    # Fallback: v(node) = value lines
    if not node_voltages:
        for line in lines:
            m = _V_ASSIGN_RE.search(line)
            if m:
                node = m.group(1).strip()
                try:
                    node_voltages[node] = float(m.group(2))
                except ValueError:
                    pass

    if not node_voltages:
        warnings.append(
            "No OP node voltages parsed from stdout. "
            "Consider adding '.control op; print allv; quit; .endc' to the netlist for reliable parsing."
        )

    return {
        "ok": True,
        "analysis": "op",
        "op": {"nodeVoltages": node_voltages},
        "warnings": warnings,
        "raw": raw_output,
    }
