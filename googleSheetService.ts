
import { Task } from "./types";

/**
 * To use this service, you need to set up a Google Apps Script as a Web App:
 * 
 * function doPost(e) {
 *   var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *   var data = JSON.parse(e.postData.contents);
 *   sheet.appendRow([
 *     new Date(), 
 *     data.userId, 
 *     data.userName, 
 *     data.date, 
 *     data.title, 
 *     data.category, 
 *     data.topic, 
 *     data.duration, 
 *     data.startTime
 *   ]);
 *   return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
 * }
 */

// Replace this with your actual Google Apps Script Web App URL
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbz_MOCK_URL_PLACEHOLDER/exec";

export const saveTaskToGoogleSheet = async (task: Task, userName: string): Promise<boolean> => {
  if (!task.completed) return false;

  try {
    const payload = {
      ...task,
      userName
    };

    // Using fetch with 'no-cors' for simple Google Apps Script integration if needed, 
    // but ideally the script handles CORS.
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: "POST",
      mode: "no-cors", // Apps Script often requires redirect handling which 'no-cors' simplifies for one-way sync
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // With 'no-cors', we can't see the response status, so we assume success if no error is thrown
    return true;
  } catch (error) {
    console.error("Failed to sync with Google Sheets:", error);
    return false;
  }
};
