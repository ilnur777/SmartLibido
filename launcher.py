import subprocess
import time
import os
import signal
import sys

# Пути
BASE_DIR = r"C:/Users/Ilnur/OneDrive/Рабочий стол/FemTech/SmartLibido"
NODE_EXE = "node"
SERVER_JS = os.path.join(BASE_DIR, "server.js")

def run():
    print("Starting Server...")
    server_proc = subprocess.Popen([NODE_EXE, SERVER_JS], cwd=BASE_DIR)
    
    print("Starting Tunnel...")
    # Используем npx localtunnel
    tunnel_proc = subprocess.Popen(["npx.cmd", "localtunnel", "--port", "3000"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    
    url = ""
    start_time = time.time()
    
    while time.time() - start_time < 30:
        line = tunnel_proc.stdout.readline()
        if "your url is:" in line:
            url = line.split("is:")[1].strip()
            print(f"URL FOUND: {url}")
            break
        time.sleep(1)

    if not url:
        print("Failed to get URL")
        server_proc.terminate()
        tunnel_proc.terminate()
        return

    print("--- SYSTEM READY ---")
    print(f"Link: {url}")
    
    try:
        while True:
            if server_proc.poll() is not None:
                print("Server died, restarting...")
                server_proc = subprocess.Popen([NODE_EXE, SERVER_JS], cwd=BASE_DIR)
            if tunnel_proc.poll() is not None:
                print("Tunnel died, restarting...")
                tunnel_proc = subprocess.Popen(["npx.cmd", "localtunnel", "--port", "3000"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            time.sleep(5)
    except KeyboardInterrupt:
        server_proc.terminate()
        tunnel_proc.terminate()

if __name__ == "__main__":
    run()
