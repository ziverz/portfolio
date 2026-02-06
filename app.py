import os
import ffmpeg
from flask import Flask, render_template, request, send_file, after_this_request

app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert_video():
    uploaded_file = request.files['file']
    
    if uploaded_file.filename == '':
        return "No file selected", 400

    # 1. Capture the original filename to make a dynamic download name
    original_filename = uploaded_file.filename
    # "my_video.mp4" -> "my_video"
    base_name = os.path.splitext(original_filename)[0]
    # "my_video" -> "my_video.mp3"
    new_download_name = f"{base_name}.mp3"

    # 2. Use generic names for server processing (keeps things safe)
    input_path = "temp_input.mp4"
    output_path = "temp_output.mp3"
    uploaded_file.save(input_path)

    try:
        stream = ffmpeg.input(input_path)
        stream = ffmpeg.output(stream, output_path, acodec='libmp3lame', audio_bitrate='192k')
        ffmpeg.run(stream, overwrite_output=True)
    except Exception as e:
        return f"CRASH REPORT: {type(e).__name__} - {str(e)}", 500

    @after_this_request
    def remove_files(response):
        try:
            if os.path.exists(input_path):
                os.remove(input_path)
            if os.path.exists(output_path):
                os.remove(output_path)
        except Exception as e:
            print(f"Error cleaning up: {e}")
        return response

    # 3. Send the file with the new custom name
    return send_file(output_path, as_attachment=True, download_name=new_download_name)

if __name__ == '__main__':
    app.run(debug=True)