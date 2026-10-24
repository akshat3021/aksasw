import httpx
import json

def inspect():
    url = "https://data.elexon.co.uk/swagger/v1/swagger.json"
    r = httpx.get(url, timeout=30.0)
    spec = r.json()
    paths = spec.get("paths", {})
    
    matched = [p for p in paths if any(x in p.lower() for x in ["fuelhh", "windfor"])]
    print("Found paths:", matched)
    
    for p in matched:
        print("\n" + "=" * 70)
        print("PATH:", p)
        for method, info in paths[p].items():
            print(f"Method: {method.upper()}")
            print(f"Summary: {info.get('summary')}")
            print(f"Description: {info.get('description')}")
            print("Parameters:")
            for param in info.get("parameters", []):
                name = param.get("name")
                pin = param.get("in")
                req = param.get("required")
                schema = param.get("schema", {})
                ptype = schema.get("type")
                pformat = schema.get("format")
                desc = param.get("description", "")
                print(f"  - {name} (in={pin}, required={req}, type={ptype}, format={pformat}): {desc}")

if __name__ == "__main__":
    inspect()
