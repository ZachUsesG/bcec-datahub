import pandas as pd
from glob import glob

def normalize_linkedin(url):
    if not url or pd.isna(url):
        return None
    url = url.lower().strip()
    url = url.replace("https://", "").replace("http://", "")
    url = url.replace("www.", "")
    url = url.split("?")[0].rstrip("/")
    return url

bcec = pd.read_csv(
    "data/canonical/bcec_cleaned_alumni - Sheet1.csv",
    dtype=str
)

bcec["linkedin_norm"] = bcec["LinkedIn"].apply(normalize_linkedin)

phantom_files = glob("data/phantom_raw/phantombuster-all-leads-*.csv")
phantom = pd.concat([pd.read_csv(f, dtype=str) for f in phantom_files])

phantom["linkedin_norm"] = phantom["linkedinProfileUrl"].apply(normalize_linkedin)

phantom = phantom.drop_duplicates(subset="linkedin_norm")

merged = bcec.merge(
    phantom,
    on="linkedin_norm",
    how="left"
)

external_profiles = merged[[
    "Email",
    "linkedin_norm",
    "linkedinJobTitle",
    "companyName",
    "location"
]].copy()

external_profiles = external_profiles.rename(columns={
    "linkedinJobTitle": "current_title",
    "companyName": "current_company"
})

external_profiles["data_source"] = "phantombuster"
external_profiles["last_verified_at"] = "2025F"

external_profiles.to_csv(
    "data/derived/external_profiles_ready.csv",
    index=False
)

print("Built external_profiles_ready.csv")
print(f"Rows: {len(external_profiles)}")
print(f"Matched profiles: {external_profiles['current_title'].notna().sum()}")
