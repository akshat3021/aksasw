import httpx
import json

def inspect():
    url = "https://data.elexon.co.uk/bmrs/api/v1/openapi.json"
    r = httpx.get(url, timeout=30.0)
    spec = r.json()
    paths = spec.get("paths", {})
    
    targets = ["/datasets/fuelhh", "/datasets/fuelhh/stream", "/datasets/windfor", "/datasets/windfor/stream"]
    
    for target in targets:
        # find matching path (case-insensitive)
        matched = [p for p in paths if p.lower() == target.lower()]
        for p in matched:
            print("=" * 70)
            print("PATH:", p)
            methods = paths[p]
            for method, info in methods.items():
                print("METHOD:", method.upper())
                print("SUMMARY:", info.get("summary"))
                print("DESCRIPTION:", info.get("description"))
                print("PARAMETERS:")
                for param in info.get("parameters", []):
                    name = param.get("name")
                    pin = param.get("in")
                    req = param.get("required")
                    schema = param.get("schema", {})
                    ptype = schema.get("type")
                    pformat = schema.get("format")
                    desc = param.get("description", "")
                    print(f"  - {name} ({pin}, type={ptype}, format={pformat}, required={req}): {desc}")

if __name__ == "__main__":
    inspect()
