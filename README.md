# Tennis results site

Static site (no server, no build step). Files: index.html, style.css, app.js, data.js (generated).

## Update after adding results
1. Save T-Report.xlsx.
2. Run: python build_data.py "C:\Users\gambinis\Desktop\T-Report.xlsx"   (needs: pip install openpyxl)
3. Re-upload the folder (data.js changes).

## Preview locally
Double-click index.html.

## Publish (examples)
- Netlify: drag the whole folder to https://app.netlify.com/drop
- Firebase: firebase init hosting (public dir = this folder), then firebase deploy
- GitHub Pages: push the folder, enable Pages.

The site is public: it shows opponent names, results, notes and goals from the Excel.

## How matches are classified (column "Comment")
- "N° League 'YY" -> league level N (7 to 2), season YY (no year -> year of the match)
- "Winter League" -> Winter League season (Nov-Apr)
- QF/SF/F-League -> league playoffs
- blank or anything else (Hard, racquet, Tie-Breaks match...) -> friendly
- "Walkover - ..." -> counted normally in its year and league, also tagged "Walkover" and listed in its own statistic

## Fully online setup (GitHub Pages + OneDrive Excel)
1. Create a GitHub repository (public, e.g. "tennis"). Upload all files of this folder, including the hidden-looking `.github` folder.
2. Repo > Settings > Pages > Source: "GitHub Actions".
3. In OneDrive: open T-Report.xlsx > Share > "Anyone with the link" > View only > copy the link.
   Repo > Settings > Secrets and variables > Actions > New repository secret: name `EXCEL_URL`, value = that link.
4. Repo > Actions > "Update site from OneDrive Excel" > Run workflow. The site appears at https://<username>.github.io/<repo>/
5. From then on: edit the Excel in OneDrive. The site refreshes every 2 hours, or run the workflow by hand for an instant update.
   If the Excel cannot be downloaded or is invalid, the old site stays online and the Actions tab shows a red cross.
Note: anyone who has the OneDrive link can open the whole Excel. Use a clean copy of the file for sharing if it holds private notes.
