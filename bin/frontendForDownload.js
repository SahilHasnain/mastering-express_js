const downloadFromS3 = async (key) => {
    const res = await fetch(
        `http://localhost:5000/generate-download-url?key=${key}`
    );
    const data = await res.json();

    window.location.href = data.downloadUrl; // direct S3 download
};
