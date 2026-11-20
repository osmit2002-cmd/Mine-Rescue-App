# Saving builder problems in a folder on your computer

The builder keeps the problems you are working on in the browser. To keep the ones you want, and to share them, it
saves each one as a file, `<title>.mrs-problem.json`, in a folder you choose on your computer.

## Chrome and Edge: link a folder

1. In the builder, open **Folder → Link a folder…** and choose (or create) a folder, for example
   `Documents\Mine Rescue Problems`. Allow the browser to view and edit files there.
2. Every problem file in that folder now shows in the problem list (📁 marks problems with a file).
3. **Save** writes the current problem to the folder (it asks for a name first if the problem is still called
   "New problem"). After that, edits to a saved problem are written to its file a couple of seconds later.
4. **Folder → Reload** picks up files that were added or changed in the folder outside the app (copied from a
   teammate, a USB stick, a shared drive…).
5. **Delete** removes the problem from the list and deletes its file from the folder.

The app remembers the folder. After the browser restarts it needs one click to open it again
(**Folder → Open "…" again**, or just press Save). **Folder → Unlink folder** stops using it; the files stay.

A folder synced by OneDrive, Google Drive for desktop or Dropbox works too, so problems can follow you between
computers.

## Starter problems

The sample problems and the transcribed past contest problems are kept in the repo as problem files in
`public/starter-problems/` (they are served with the app, so they work offline too). **Folder → Get starter
problems** (or "Get the starter problems" on a first visit) adds them to the list and saves their files:

- into the linked folder (files already there are left alone), or
- to the Downloads folder when no folder is linked, or
- through the share sheet on a phone or tablet.

After changing a sample or a reference case in `src/builder`, run `npm run starters` to rewrite the files; a test
fails while they are out of date.

## Phones and tablets

Phones cannot link a folder. **Save** opens the share sheet, so the file can go to Files / iCloud Drive / Google
Drive / OneDrive / Dropbox or onto the phone. **Folder → Open files…** brings files back in from any of those.

## Firefox and Safari on a computer

These browsers cannot link a folder. **Save** downloads the problem file to the Downloads folder (or wherever the
browser saves downloads).
**Folder → Open files…** brings one or more problem files back into the builder.
