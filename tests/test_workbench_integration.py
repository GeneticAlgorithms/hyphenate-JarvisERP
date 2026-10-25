"""Integration tests for workbench /api/wb/run endpoints.

Tests that every tab runs successfully through the workbench API.
"""
import pytest
import requests
import time

BASE_URL = "http://localhost:8001"

TABS = [
    "p1_timing",
    "p2_rollforward",
    "p3_bank",
    "p4_evidence",
    "p5_vendors",
]


class TestWorkbenchRun:
    """Test /api/wb/run for each tab."""
    
    @pytest.fixture(scope="class", autoresource=True)
    def server_running(self):
        """Verify server is up before running tests."""
        try:
            resp = requests.get(f"{BASE_URL}/api/state", timeout=5)
            assert resp.status_code == 200
        except Exception as e:
            pytest.skip(f"Server not running: {e}")
    
    def test_p1_timing(self):
        """Test P1 Timing tab runs without failure."""
        resp = requests.post(
            f"{BASE_URL}/api/wb/run",
            json={"agent": "p1_timing"},
            timeout=120
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data["problem"] == "p1_timing"
        assert data["status"] in ("running", "awaiting_approval", "done")
        
        # Wait for completion
        run_id = data["id"]
        for _ in range(60):  # Max 60 seconds
            time.sleep(1)
            status_resp = requests.get(f"{BASE_URL}/api/wb/run/{run_id}")
            status_data = status_resp.json()
            
            if status_data["status"] in ("awaiting_approval", "done"):
                assert status_data["status"] != "failed", f"Run failed: {status_data.get('error')}"
                return
        
        pytest.fail("Run did not complete within 60 seconds")
    
    def test_p2_rollforward(self):
        """Test P2 Rollforward tab runs without failure."""
        resp = requests.post(
            f"{BASE_URL}/api/wb/run",
            json={"agent": "p2_rollforward"},
            timeout=120
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data["problem"] == "p2_rollforward"
        assert data["status"] != "failed"
    
    def test_p3_bank(self):
        """Test P3 Bank tab runs without failure."""
        resp = requests.post(
            f"{BASE_URL}/api/wb/run",
            json={"agent": "p3_bank"},
            timeout=120
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data["problem"] == "p3_bank"
        assert data["status"] != "failed"
    
    def test_p4_evidence(self):
        """Test P4 Evidence tab runs without failure."""
        resp = requests.post(
            f"{BASE_URL}/api/wb/run",
            json={"agent": "p4_evidence"},
            timeout=120
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data["problem"] == "p4_evidence"
        assert data["status"] != "failed"
    
    def test_p5_vendors(self):
        """Test P5 Vendors tab runs without failure."""
        resp = requests.post(
            f"{BASE_URL}/api/wb/run",
            json={"agent": "p5_vendors"},
            timeout=120
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data["problem"] == "p5_vendors"
        assert data["status"] != "failed"


class TestWorkbenchValidation:
    """Additional validation tests."""
    
    def test_all_tabs_complete(self):
        """Test that all 5 tabs can complete successfully."""
        results = {}
        
        for tab in TABS:
            resp = requests.post(
                f"{BASE_URL}/api/wb/run",
                json={"agent": tab},
                timeout=120
            )
            
            if resp.status_code != 200:
                results[tab] = f"HTTP {resp.status_code}"
                continue
            
            data = resp.json()
            run_id = data["id"]
            
            # Wait for completion
            for _ in range(60):
                time.sleep(1)
                status_resp = requests.get(f"{BASE_URL}/api/wb/run/{run_id}")
                status_data = status_resp.json()
                
                if status_data["status"] in ("awaiting_approval", "done"):
                    results[tab] = "success"
                    break
                elif status_data["status"] == "failed":
                    results[tab] = f"failed: {status_data.get('error', 'unknown')}"
                    break
            else:
                results[tab] = "timeout"
        
        # Report results
        failures = {k: v for k, v in results.items() if v != "success"}
        assert not failures, f"Failed tabs: {failures}"
