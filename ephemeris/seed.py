"""Seed the DB with freelance spreadsheet data.

Idempotent: skips rows already present (matched on date+description+amount).
Halo client rows → "Halo" tag; everything else freelance → "Freelance Consulting".
"""
from datetime import datetime
from db import get_conn, init_db


def parse_date(s):
    s = s.strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"Bad date: {s}")


def tag_for_client(client: str) -> str:
    if not client:
        return "Freelance Consulting"
    c = client.strip().lower()
    if "halo" in c:
        return "Halo"
    return "Freelance Consulting"


# (date, description, amount_positive, category, client, tax_status, notes)
EXPENSES = [
    ("1/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "Backcountry Academics", "TBD - 2024", ""),
    ("1/24/2024", "ConEd", 86.33, "F&O - Utilities", "", "2024 - TBD", ""),
    ("2/6/2024", "Acloud Guru Education", 378.89, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("2/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("2/23/2024", "ConEd", 96.28, "F&O - Utilities", "", "2024 - TBD", ""),
    ("3/10/2024", "Fiverr Freelance Web Development", 581.31, "COGS - Professional Fees", "", "2024 - TBD", ""),
    ("3/10/2024", "Fiverr Freelance Web Development", 91.79, "COGS - Professional Fees", "", "2024 - TBD", ""),
    ("3/11/2024", "TurboTax", 193.80, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("3/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("3/25/2024", "ConEd", 89.59, "F&O - Utilities", "", "2024 - TBD", ""),
    ("4/3/2024", "Macafee Antivirus", 97.99, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("4/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("4/23/2024", "ConEd", 86.93, "F&O - Utilities", "", "2024 - TBD", ""),
    ("5/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("5/22/2024", "ConEd", 90.52, "F&O - Utilities", "", "2024 - TBD", ""),
    ("6/4/2024", "Mobbin Subscription", 120.00, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("6/10/2024", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("6/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("6/20/2024", "Drivereasy Subscription", 29.95, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("6/21/2024", "ConEd", 145.35, "F&O - Utilities", "", "2024 - TBD", ""),
    ("7/10/2024", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("7/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("7/23/2024", "ConEd", 155.71, "F&O - Utilities", "", "2024 - TBD", ""),
    ("8/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("8/14/2024", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("8/15/2024", "Cobra Payment for August", 2162.78, "L&A - Health Insurance Fees", "", "2024 - TBD", ""),
    ("8/20/2024", "Crunchbase Annual Subscription", 588.00, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("8/21/2024", "ConEd", 108.11, "F&O - Utilities", "", "2024 - TBD", ""),
    ("9/4/2024", "Drivereasy Subscription", 29.95, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("9/10/2024", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("9/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("9/14/2024", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("9/18/2024", "CVS Office supplies", 10.10, "F&O - Office Supplies", "", "2024 - TBD", ""),
    ("9/20/2024", "WestSide Tennis", 84.11, "T&E - Entertainment", "", "2024 - TBD", ""),
    ("9/20/2024", "ConEd", 110.44, "F&O - Utilities", "", "2024 - TBD", ""),
    ("9/24/2024", "Cobra Payment for September", 1081.39, "L&A - Health Insurance Fees", "", "2024 - TBD", ""),
    ("9/24/2024", "Matt Trappe Substack", 6.00, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("9/27/2024", "Dropbox", 119.88, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("10/10/2024", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("10/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("10/14/2024", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("10/17/2024", "CVS Office supplies", 11.29, "F&O - Office Supplies", "", "2024 - TBD", ""),
    ("10/21/2024", "Express VPN", 99.95, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("10/21/2024", "CVS Office supplies", 12.43, "F&O - Office Supplies", "", "2024 - TBD", ""),
    ("10/21/2024", "ConEd", 106.47, "F&O - Utilities", "", "2024 - TBD", ""),
    ("10/24/2024", "Cobra Payment for October", 1081.39, "L&A - Health Insurance Fees", "", "2024 - TBD", ""),
    ("10/26/2024", "Arrivederci Cucina Fountain Hills", 82.00, "T&E - Meals", "", "2024 - TBD", ""),
    ("10/26/2024", "Bakeshop in Phoenix", 22.86, "T&E - Meals", "", "2024 - TBD", ""),
    ("10/28/2024", "Overeasy Scottsdale", 23.64, "T&E - Meals", "", "2024 - TBD", ""),
    ("11/10/2024", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("11/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("11/14/2024", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("11/19/2024", "Cobra Payment for November", 1081.39, "L&A - Health Insurance Fees", "", "2024 - TBD", ""),
    ("11/20/2024", "ConEd", 103.67, "F&O - Utilities", "", "2024 - TBD", ""),
    ("12/4/2024", "Express VPN", 116.95, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("12/10/2024", "Upwork Connect Payment", 16.33, "S&M - Advertising", "", "2024 - TBD", ""),
    ("12/10/2024", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("12/12/2024", "Starry Internet", 55.00, "F&O - Utilities", "", "TBD - 2024", ""),
    ("12/14/2024", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "2024 - TBD", ""),
    ("12/19/2024", "Cobra Payment for December", 1195.88, "L&A - Health Insurance Fees", "", "2024 - TBD", ""),
    ("12/23/2024", "ConEd", 94.89, "F&O - Utilities", "", "2024 - TBD", ""),
    ("1/2/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("1/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("1/12/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("1/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("1/18/2025", "Noun Project", 39.99, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("1/22/2025", "Gift Card Granny", 100.00, "S&M - Events & Conferences", "", "", ""),
    ("1/24/2025", "Dots Cafe New York", 10.83, "T&E - Meals", "", "", ""),
    ("1/24/2025", "ConEd", 80.91, "F&O - Utilities", "", "", ""),
    ("1/25/2025", "Curb NYC Taxi", 21.90, "T&E - Transportation", "", "", ""),
    ("1/25/2025", "PJ Clarks", 116.00, "T&E - Meals", "", "", ""),
    ("1/25/2025", "Cobra Payment for January", 1195.88, "L&A - Health Insurance Fees", "", "", ""),
    ("1/29/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("2/3/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("2/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("2/12/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("2/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("2/18/2025", "Fiverr Freelance Brand Design Work", 221.55, "S&M - Professional Fees", "", "", ""),
    ("2/24/2025", "Cobra Payment for February", 1195.88, "L&A - Health Insurance Fees", "", "", ""),
    ("2/28/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("3/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("3/5/2025", "ND Tennis Tax", 250.00, "F&O - Uncategorized Expense", "", "", ""),
    ("3/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("3/12/2025", "Powered by Halo Subscription Test", 60.00, "F&O - Software & Apps", "Powered By Halo", "Included - 2025", ""),
    ("3/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("3/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("3/24/2025", "Battlenet Starcraft Purchase", 16.32, "R&D - Software", "Real Time Strategist", "", ""),
    ("3/24/2025", "Cobra Payment for March", 1195.88, "L&A - Health Insurance Fees", "", "", ""),
    ("3/27/2025", "Macafee Antivirus", 97.98, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("3/28/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("4/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("4/10/2025", "In Flight Wifi", 6.50, "F&O - Utilities", "", "", ""),
    ("4/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("4/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("4/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("4/21/2025", "Typeform", 31.58, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("4/24/2025", "Cobra Payment for April", 1195.88, "L&A - Health Insurance Fees", "", "", ""),
    ("4/29/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("5/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("5/2/2025", "AWS Billing Statement", 3.58, "COGS - Software", "", "", ""),
    ("5/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("5/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("5/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("5/20/2025", "Drivereasy Subscription", 29.95, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("5/21/2025", "Typeform", 31.58, "F&O - Software & Apps", "ND Tennis Alum", "Included - 2025", ""),
    ("5/29/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("5/29/2025", "Cobra Payment for May", 1195.88, "L&A - Health Insurance Fees", "", "", ""),
    ("6/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("6/2/2025", "AWS services bill", 3.58, "F&O - Software & Apps", "", "", ""),
    ("6/3/2025", "Mobbin Subscription", 120.00, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("6/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("6/13/2025", "Docusign Subscription (Annual)", 130.65, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("6/14/2025", "AWS Domain (sparkworkbench.com)", 14.00, "F&O - Software & Apps", "", "", ""),
    ("6/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("6/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("6/21/2025", "Typeform", 31.58, "F&O - Software & Apps", "ND Tennis Alum", "Included - 2025", ""),
    ("6/29/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("7/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("7/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("7/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("7/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("7/19/2025", "Brooke Designs", 1500.00, "COGS - Software", "Powered By Halo", "", ""),
    ("7/29/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("8/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("8/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("8/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("8/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("8/28/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("9/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("9/5/2025", "Drivereasy Subscription", 29.95, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("9/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("9/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("9/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("9/29/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("10/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("10/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("10/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("10/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("10/28/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("11/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("11/1/2025", "Cursor", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("11/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("11/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("11/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("11/20/2025", "Caltrain", 6.25, "T&E - Transportation", "", "", ""),
    ("11/22/2025", "Delta Air Service Fee", 5.00, "F&O - Utilities", "", "", ""),
    ("11/28/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("11/28/2025", "Ask GPT app", 39.99, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("12/1/2025", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("12/1/2025", "Cursor", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("12/3/2025", "Express VPN", 116.95, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("12/4/2025", "Express VPN", 116.95, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("12/10/2025", "Figma Monthly Subscription", 5.45, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("12/14/2025", "Chat GPT Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("12/15/2025", "Starry Internet", 65.00, "F&O - Utilities", "", "Included - 2025", ""),
    ("12/16/2025", "Bucherie Lunch", 46.01, "T&E - Meals", "", "", "Met Tom to discuss annotation space"),
    ("12/24/2025", "GPT Zero", 26.12, "F&O - Software & Apps", "", "", ""),
    ("12/28/2025", "Claude AI Subscription", 21.78, "F&O - Software & Apps", "", "Included - 2025", ""),
    ("1/1/2026", "Amazon AWS", 3.59, "F&O - Software & Apps", "", "", ""),
    ("1/1/2026", "Google Cloud Payment", 1.10, "F&O - Software & Apps", "", "", ""),
    ("1/2/2026", "LinkedIn Premium", 280.10, "F&O - Software & Apps", "", "", ""),
]

# (date, description, amount, client)
INCOME = [
    ("4/4/2022", "Continued App Development (App Dev P1)", 7500.00, "7 Shot Tennis"),
    ("10/3/2022", "Continued App Development (App Dev P2)", 2500.00, "7 Shot Tennis"),
    ("11/30/2022", "Continued App Development (Oct)", 800.00, "7 Shot Tennis"),
    ("11/30/2022", "Continued App Development (Nov)", 800.00, "7 Shot Tennis"),
    ("1/17/2023", "Continued App Development (Dec)", 800.00, "7 Shot Tennis"),
    ("1/26/2023", "Continued App Development (Jan)", 800.00, "7 Shot Tennis"),
    ("2/27/2023", "Continued App Development (Feb)", 800.00, "7 Shot Tennis"),
    ("4/4/2023", "Continued App Development (March)", 800.00, "7 Shot Tennis"),
    ("5/2/2023", "Continued App Development (April)", 1000.00, "7 Shot Tennis"),
    ("6/5/2023", "Continued App Development (May)", 800.00, "7 Shot Tennis"),
    ("7/15/2023", "Continued App Development (June)", 800.00, "7 Shot Tennis"),
    ("7/15/2023", "Continued App Development (End June - July 14)", 800.00, "7 Shot Tennis"),
    ("8/12/2023", "MVP Development", 1350.00, "XX-Ali-Walton"),
    ("8/27/2023", "Continued App Development (End July - Aug)", 800.00, "7 Shot Tennis"),
    ("9/26/2023", "Continued App Development (End Mid Aug - Mid Sep)", 800.00, "7 Shot Tennis"),
    ("10/12/2023", "Continued App Development (End Mid Sep - Oct)", 1200.00, "7 Shot Tennis"),
    ("11/3/2023", "Continued App Development (End Mid Oct - Nov)", 867.00, "7 Shot Tennis"),
    ("12/5/2023", "Continued App Development (End Mid Nov - Dec)", 867.00, "7 Shot Tennis"),
    ("1/3/2024", "Continued App Development (Bonus)", 400.00, "7 Shot Tennis"),
    ("2/4/2024", "Continued App Development (month of Jan)", 867.00, "7 Shot Tennis"),
    ("3/7/2024", "Continued App Development (month of Feb)", 867.00, "7 Shot Tennis"),
    ("3/13/2024", "Website Design", 1000.00, "Ukraine Global Scholars"),
    ("3/17/2024", "Website Design + Development", 800.00, "Backcountry Academics"),
    ("4/9/2024", "Continued App Development (month of March)", 867.00, "7 Shot Tennis"),
    ("5/4/2024", "Website Design + Development (month of April)", 800.00, "Backcountry Academics"),
    ("5/21/2024", "Continued App Development (month of April)", 100.00, "7 Shot Tennis"),
    ("5/30/2024", "Website Design + Development (Month of May)", 800.00, "Backcountry Academics"),
    ("6/10/2024", "Continued App Development (month of May)", 100.00, "7 Shot Tennis"),
    ("7/5/2024", "Website Design + Development (Month of June)", 800.00, "Backcountry Academics"),
    ("7/23/2024", "Product Development", 13000.00, "Powered By Halo"),
    ("7/20/2024", "Website Design + Development (Month of June + half July)", 150.00, "7 Shot Tennis"),
    ("8/17/2024", "For July + August", 150.00, "7 Shot Tennis"),
    ("9/15/2024", "August?", 200.00, "7 Shot Tennis"),
    ("9/20/2024", "COO Month 1 (August)", 10000.00, "Powered By Halo"),
    ("11/6/2024", "September", 867.00, "7 Shot Tennis"),
    ("10/11/2024", "COO Month 2 (Payment for September)", 10000.00, "Powered By Halo"),
    ("12/11/2024", "November Payment", 867.00, "7 Shot Tennis"),
    ("11/15/2024", "COO Month 3 (Payment for October)", 10000.00, "Powered By Halo"),
    ("1/6/2025", "December Payment", 867.00, "7 Shot Tennis"),
    ("1/3/2025", "COO Month 4 (Payment for November)", 10000.00, "Powered By Halo"),
    ("1/11/2025", "Margaret Kelley Support", 1050.00, "Backcountry Academics"),
    ("1/28/2025", "COO Month 5 (Payment for December)", 10000.00, "Powered By Halo"),
    ("2/7/2025", "January Payment", 867.00, "7 Shot Tennis"),
    ("2/11/2025", "COO Month 6 (Payment for January)", 10000.00, "Powered By Halo"),
    ("2/17/2025", "January Payment", 300.00, "Backcountry Academics"),
    ("3/5/2025", "February Payment", 450.00, "Backcountry Academics"),
    ("3/10/2025", "COO Month 7 (Payment for February)", 10000.00, "Powered By Halo"),
    ("3/15/2025", "February Payment", 867.00, "7 Shot Tennis"),
    ("3/31/2025", "March Payment", 225.00, "Backcountry Academics"),
    ("4/2/2025", "COO Month 8 (Payment for March)", 10000.00, "Powered By Halo"),
    ("4/29/2025", "March Payment", 867.00, "7 Shot Tennis"),
    ("5/5/2025", "COO Month 9 (Payment for April)", 10000.00, "Powered By Halo"),
    ("5/15/2025", "April Payment", 867.00, "7 Shot Tennis"),
    ("5/29/2025", "COO Month 10 (Payment for half of May)", 5000.00, "Powered By Halo"),
    ("7/2/2025", "May Payment", 867.00, "7 Shot Tennis"),
    ("7/28/2025", "One time expense consolidation", 250.00, "Backcountry Academics"),
]

# (date, hours, rate, pay_status, client, project, description)
HOURS = [
    ("1/8/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", ""),
    ("1/10/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", ""),
    ("1/16/2025", 1.5, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", ""),
    ("1/23/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", ""),
    ("1/24/2025", 2, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", ""),
    ("2/4/2025", 2, 0, "NA", "Backcountry Academics", "", "Website update + expense confirmation"),
    ("2/9/2025", 1, 0, "NA", "Backcountry Academics", "", "Configure calendar"),
    ("2/9/2025", 3, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Deploy player updates"),
    ("2/10/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Met with Dave"),
    ("2/15/2025", 1, 0, "NA", "Backcountry Academics", "", "Configure calendar"),
    ("2/15/2025", 3, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Clean up bugs in new player panel"),
    ("2/16/2025", 3, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Updating home screen and scoring fix"),
    ("2/18/2025", 1, 0, "NA", "Data Hunter", "", "Set up Beehiiv"),
    ("2/19/2025", 0.5, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Resolve start new match bug"),
    ("2/17/2025", 0.5, 0, "NA", "Backcountry Academics", "", "Calendar guide"),
    ("2/21/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Fixing scorecard issues"),
    ("2/23/2025", 1, 0, "NA", "Backcountry Academics", "", "Discussing tax needs"),
    ("2/24/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "UTR partnership chat"),
    ("2/25/2025", 1, 0, "NA", "UTR", "", "Universal shot metric thoughts"),
    ("2/28/2025", 0.5, 0, "NA", "Backcountry Academics", "", "Assisted with college search"),
    ("3/1/2025", 1.5, 0, "NA", "Data Hunter", "", "Initial email post"),
    ("3/4/2025", 1, 0, "NA", "Data Hunter", "", "Email post development"),
    ("3/7/2025", 2, 0, "NA", "Data Hunter", "", "Email post refinement"),
    ("3/8/2025", 2, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Bug fixes"),
    ("3/14/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Partnership strategy"),
    ("3/15/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Tech enhancements plan"),
    ("3/15/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Pitch deck v1"),
    ("3/15/2025", 2, 0, "NA", "Data Hunter", "", "Data valuation framework"),
    ("3/17/2025", 2, 0, "NA", "Data Hunter", "", "Dataset assessment framework"),
    ("3/19/2025", 0.5, 0, "NA", "Backcountry Academics", "", "Chatting with Margaret"),
    ("3/19/2025", 3, 0, "NA", "Real Time Strategist", "", "Data output test case"),
    ("3/23/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Prepping pitch deck"),
    ("3/23/2025", 3, 0, "NA", "Real Time Strategist", "", "Parsing game files"),
    ("3/24/2025", 1, 0, "NA", "Backcountry Academics", "", "GoDaddy billing"),
    ("3/21/2025", 2, 0, "NA", "Real Time Strategist", "", "Data parsing"),
    ("3/25/2025", 3, 0, "NA", "Real Time Strategist", "", "Data parsing"),
    ("3/27/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Player video bug"),
    ("3/27/2025", 1, 0, "NA", "Backcountry Academics", "", "Talking to Topline"),
    ("4/3/2025", 3, 0, "NA", "Real Time Strategist", "", "Data parsing script"),
    ("4/4/2025", 2, 0, "NA", "Real Time Strategist", "", "Data parsing script"),
    ("4/9/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Pitch deck discussion"),
    ("4/13/2025", 1, 0, "NA", "ND Tennis Alumni", "", "Designed the Flyer"),
    ("4/15/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Reviewing deck"),
    ("4/16/2025", 2, 0, "NA", "ND Tennis Alumni", "", "Initial platform pass"),
    ("4/18/2025", 2, 0, "NA", "ND Tennis Alumni", "", "Directory dashboard"),
    ("4/19/2025", 3, 0, "NA", "ND Tennis Alumni", "", "Dashboard + sign-in"),
    ("4/20/2025", 3, 0, "NA", "ND Tennis Alumni", "", "Updating dashboard"),
    ("4/22/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Pitch deck"),
    ("4/25/2025", 1, 0, "NA", "Backcountry Academics", "", "Update link"),
    ("4/25/2025", 1, 0, "NA", "Drop The List", "", "Initial discussion"),
    ("4/26/2025", 2, 0, "NA", "Drop The List", "", "Project planning"),
    ("4/27/2025", 2, 0, "NA", "Drop The List", "", "Project planning"),
    ("4/30/2025", 1.5, 0, "NA", "Drop The List", "", "Email distribution"),
    ("5/13/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "General catch up"),
    ("5/18/2025", 2, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Pitch deck"),
    ("5/29/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Pitch deck discussion"),
    ("5/29/2025", 0.5, 0, "NA", "Backcountry Academics", "", "Discuss calculus tutor"),
    ("6/1/2025", 2, 0, "NA", "Codex", "", "Prompt engineering"),
    ("6/3/2025", 3, 0, "NA", "Codex", "", "Developing platform"),
    ("6/3/2025", 0.5, 0, "NA", "ND Tennis Alumni", "", "Personal profiles"),
    ("6/4/2025", 1, 0, "NA", "ND Tennis Alumni", "", "Personal profiles"),
    ("6/6/2025", 2, 0, "NA", "ND Tennis Alumni", "", "Personal profiles"),
    ("6/8/2025", 2, 0, "NA", "ND Tennis Alumni", "", "Dashboard"),
    ("6/9/2025", 1, 0, "NA", "Codex", "", "Project page updates"),
    ("6/10/2025", 0.5, 0, "NA", "Codex", "", "Action entry page"),
    ("6/18/2025", 1, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Pitch to UTR"),
    ("6/19/2025", 0.5, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Pitch recap"),
    ("6/23/2025", 1.5, 0, "NA", "Codex", "", "Action entry page"),
    ("6/24/2025", 1, 0, "NA", "Codex", "", "Adding project revenue"),
    ("7/2/2025", 0.5, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Random call"),
    ("11/28/2025", 2, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Platform enhancements"),
    ("11/28/2025", 2, 0, "NA", "7 Shot Tennis", "7 Shot Tennis Platform Operations", "Platform enhancements"),
    ("1/2/2026", 2, 100.0, "Pending", "Backcountry Academics", "", "Email + website optimization"),
]


def seed():
    init_db()
    conn = get_conn()

    tag_ids = {row["name"]: row["id"] for row in conn.execute("SELECT id, name FROM tags")}
    cat_ids = {row["name"]: row["id"] for row in conn.execute("SELECT id, name FROM categories")}

    inserted_exp = 0
    for date, desc, amt, cat, client, tax, notes in EXPENSES:
        iso_date = parse_date(date)
        existing = conn.execute(
            "SELECT id FROM expenses WHERE date=? AND description=? AND amount=?",
            (iso_date, desc, amt),
        ).fetchone()
        if existing:
            continue
        tag = tag_for_client(client)
        conn.execute(
            """INSERT INTO expenses (date, description, amount, category_id, tag_id, client, tax_status, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (iso_date, desc, amt, cat_ids.get(cat), tag_ids[tag], client or None, tax or None, notes or None),
        )
        inserted_exp += 1

    inserted_inc = 0
    for date, desc, amt, client in INCOME:
        iso_date = parse_date(date)
        existing = conn.execute(
            "SELECT id FROM income WHERE date=? AND description=? AND amount=?",
            (iso_date, desc, amt),
        ).fetchone()
        if existing:
            continue
        tag = tag_for_client(client)
        conn.execute(
            "INSERT INTO income (date, description, amount, client, tag_id) VALUES (?, ?, ?, ?, ?)",
            (iso_date, desc, amt, client, tag_ids[tag]),
        )
        inserted_inc += 1

    inserted_hrs = 0
    for date, hrs, rate, pay, client, project, desc in HOURS:
        iso_date = parse_date(date)
        existing = conn.execute(
            """SELECT id FROM hours WHERE date=? AND hours=? AND client=? AND description=?""",
            (iso_date, hrs, client, desc),
        ).fetchone()
        if existing:
            continue
        tag = tag_for_client(client)
        conn.execute(
            """INSERT INTO hours (date, hours, rate, pay_status, client, project, description, tag_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (iso_date, hrs, rate or None, pay, client, project or None, desc or None, tag_ids[tag]),
        )
        inserted_hrs += 1

    conn.commit()
    conn.close()
    print(f"Seeded: {inserted_exp} expenses, {inserted_inc} income, {inserted_hrs} hours")


if __name__ == "__main__":
    seed()
