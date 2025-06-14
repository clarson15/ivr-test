import axios from 'axios';

export async function answerCall(callControlId, CLIENT_STATE, COMMAND_ID, TELNYX_STREAM_URL, API_HEADERS) {
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`;
    const data = {
        "client_state": CLIENT_STATE,
        "command_id": COMMAND_ID,
        "stream_url": TELNYX_STREAM_URL,
        "stream_track": "inbound_track",
        "stream_bidirectional_mode": "rtp",
        "stream_bidirectional_codec": "PCMU",
        "preferred_codecs": "PCMU"
    };

    try {
        const response = await axios.post(url, data, { headers: API_HEADERS });
        console.log(`Answer Call Request successful for ID: ${callControlId}. Status code: ${response.status}`);
    } catch (error) {
        console.error(`Failed to answer call for ${callControlId}.`, error.response?.data || error.message);
    }
}