# Import the 'os' module to interact with the operating system (file operations like checking if files exist, removing files)
import os
# Import the 'ffmpeg' library to handle video/audio conversion
import ffmpeg
# Import Flask and related functions: Flask (main app), render_template (to serve HTML), request (to handle incoming data), send_file (to send files back to user), after_this_request (to run cleanup after sending response)
from flask import Flask, render_template, request, send_file, after_this_request

# Create a Flask application instance with custom settings:
# __name__ tells Flask where to look for resources
# template_folder='.' means look for HTML templates in the current directory
# static_folder='.' means look for static files (CSS, JS, images) in the current directory
# static_url_path='' means static files are served from the root URL path
app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')

# Define a route for the home page (when someone visits the root URL '/')
@app.route('/')
# This function handles requests to the home page
def home():
    # Render and return the index.html template to show the main page
    return render_template('index.html')

# Define a route for '/convert' that only accepts POST requests (form submissions with data)
@app.route('/convert', methods=['POST'])
# This function handles the video to MP3 conversion
def convert_video():
    # Get the uploaded file from the request (the 'file' field from the HTML form)
    uploaded_file = request.files['file']
    
    # Check if the user actually selected a file (empty filename means no file was chosen)
    if uploaded_file.filename == '':
        # Return an error message and HTTP status code 400 (Bad Request)
        return "No file selected", 400

    # 1. Capture the original filename to make a dynamic download name
    # Store the name of the file the user uploaded (e.g., "my_video.mp4")
    original_filename = uploaded_file.filename
    # "my_video.mp4" -> "my_video"
    # Split the filename to remove the extension (.mp4), keeping only the base name
    base_name = os.path.splitext(original_filename)[0]
    # "my_video" -> "my_video.mp3"
    # Create the new download name by adding .mp3 extension to the base name
    new_download_name = f"{base_name}.mp3"

    # 2. Use generic names for server processing (keeps things safe)
    # Set a temporary path for the input file on the server
    input_path = "temp_input.mp4"
    # Set a temporary path for the output MP3 file on the server
    output_path = "temp_output.mp3"
    # Save the uploaded file to the server with the temporary input path
    uploaded_file.save(input_path)

    # Start a try block to catch any errors during conversion
    try:
        # Create an ffmpeg input stream from the temporary MP4 file
        stream = ffmpeg.input(input_path)
        # Configure the output: convert to MP3 format using libmp3lame codec at 192k bitrate (good quality)
        stream = ffmpeg.output(stream, output_path, acodec='libmp3lame', audio_bitrate='192k')
        # Run the ffmpeg conversion, overwriting the output file if it already exists
        ffmpeg.run(stream, overwrite_output=True)
    # If any error occurs during conversion, catch it
    except Exception as e:
        # Return a detailed error message with the error type and description, with HTTP status 500 (Server Error)
        return f"CRASH REPORT: {type(e).__name__} - {str(e)}", 500

    # Define a cleanup function that will run after the file is sent to the user
    @after_this_request
    # This nested function takes the response object as a parameter
    def remove_files(response):
        # Start a try block to safely attempt file deletion
        try:
            # Check if the temporary input file still exists on the server
            if os.path.exists(input_path):
                # Delete the temporary input file to free up space
                os.remove(input_path)
            # Check if the temporary output file still exists on the server
            if os.path.exists(output_path):
                # Delete the temporary output file to free up space
                os.remove(output_path)
        # If file deletion fails for any reason, catch the error
        except Exception as e:
            # Print the error to the console (won't crash the app, just logs it)
            print(f"Error cleaning up: {e}")
        # Return the response object so Flask can send it to the user
        return response

    # 3. Send the file with the new custom name
    # Send the converted MP3 file back to the user as a download with the custom filename
    # as_attachment=True makes it download instead of playing in browser
    # download_name sets the filename the user will see when downloading
    return send_file(output_path, as_attachment=True, download_name=new_download_name)

# Check if this script is being run directly (not imported as a module)
if __name__ == '__main__':
    # Start the Flask development server with debug mode enabled (auto-reloads on code changes, shows detailed errors)
    app.run(debug=True)