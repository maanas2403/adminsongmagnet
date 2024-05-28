document.addEventListener('DOMContentLoaded', () => {
  const CLIENT_ID = '78dd5f4cae814709af30c74c31113c9c';
  const CLIENT_SECRET = '906c03f0a2f84a9d879eace46f342ceb';
  const REDIRECT_URI = 'https://adminsongmagnet.vercel.app/'; // Replace 'http://localhost:3000/callback' with your redirect URI
  const SCOPE = 'playlist-modify-private playlist-modify-public'
  const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
  let currentlyPlayingAudio = null;
  let accessToken = localStorage.getItem('spotify_access_token');
  function authenticate() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}`;
    window.location.href = authUrl;
  }
  function extractAccessToken() {
    const hashParams = window.location.hash.substring(1).split('&');
    for (let i = 0; i < hashParams.length; i++) {
      const [key, value] = hashParams[i].split('=');
      if (key === 'access_token') {
        accessToken = value;
        console.log('Access Token loaded');
        return;
      }
    }
  }
  async function createPlaylist(name, description) {
    const response = await fetch('https://api.spotify.com/v1/me/playlists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        description: description,
        public: true // Change to true if you want the playlist to be public
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.id; // Returns the ID of the created playlist
    } else {
      throw new Error('Failed to create playlist');
    }
  }

  // Function to add tracks to a playlist
  async function addTracksToPlaylist(playlistId, trackUris, position) {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: trackUris,
        position: position // Specify the position where you want to add the tracks
      })
    });

    if (!response.ok) {
      throw new Error('Failed to add tracks to playlist');
    }
}
  document.getElementById('songDetails').style.display = 'none';
  document.getElementById('searchInput').addEventListener('input', function() {
    const searchTerm = this.value.trim();
    if (searchTerm.length > 0) {
      searchSong(searchTerm)
        .then(results => {
          displayResults(results);
        })
        .catch(error => {
          console.error('Error:', error);
        });
    } else {
      clearResults();
    }
  });

  document.getElementById('searchResults').addEventListener('click', async function(event) {
    document.getElementById('songDetails').style.display = 'block';
    document.getElementById('similarSongs').style.display = 'none';
    const selectedItem = event.target.closest('.result-item');
    if (selectedItem) {
      const trackId = selectedItem.dataset.trackId;
      try {
        const trackDetails = await getTrackDetails(trackId);
        // Populate the search field with the selected song
        document.getElementById('searchInput').value = `${trackDetails.name} by ${trackDetails.artists.map(artist => artist.name).join(', ')}`;
        // Hide the options container
        clearResults();
        // Display similar songs based on the selected song
        displayTrackDetails(trackDetails);
        const similarTracks = await findSimilarTracks(trackDetails);
        displaySimilarTracks(similarTracks,trackDetails);
        try {
          const playlistName = `${trackDetails.name} Mix`;
        const playlistDescription = `Playlist of all songs similar to '${trackDetails.name}' as per Song Magnet Website`;
        const playlistId = await createPlaylist(playlistName, playlistDescription);
          console.log('Created playlist with ID:', playlistId);
      
          // Add the clicked song and similar songs to the playlist
          const trackUris = []; // Array to store track URIs
          trackUris.push(`spotify:track:${trackId}`); // Add clicked song
          // Add similar songs (replace 'similarTrackUris' with an array of similar track URIs)
          const similarTrackUris = similarTracks.map(track => `spotify:track:${track.id}`);
          trackUris.push(...similarTrackUris);
      
          // Specify the position where you want to add the tracks
      
          const batchSize = 100;
        for (let i = 0; i < trackUris.length; i += batchSize) {
        const batchTrackUris = trackUris.slice(i, i + batchSize);
        await addTracksToPlaylist(playlistId, batchTrackUris, i); // Add tracks at the beginning of the playlist
    }
          console.log('Tracks added to playlist successfully');
      }   catch (error) {
          console.error('Error:', error);
      }
      } catch (error) {
        console.error('Error:', error);
      }
    }
  });

  async function findSimilarTracks(trackDetails) {
    const trackId = trackDetails.id;

    // Fetch audio features of the selected track
    const responseAudioFeatures = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`
      }
    });
    const dataAudioFeatures = await responseAudioFeatures.json();
    console.log(dataAudioFeatures);
    const { danceability, energy, valence } = dataAudioFeatures;

    // Define the range for each audio feature (plus or minus 10%)

    const mindanceability = 0.6* danceability;
const maxdanceability = 1.4* danceability;

const minenergy = 0.6* energy;
const maxenergy = 1.4* energy;

const minvalence = 0.6*valence;
const maxvalence = 1.4*valence;

    const responseTrackDetails = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${await getAccessToken()}`
    }
  });
  const trackData = await responseTrackDetails.json();
  const artistId = trackData.artists[0].id;
  const responseTopTracks = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
    headers: {
      'Authorization': `Bearer ${await getAccessToken()}`
    }
  });
  const topTracksData = await responseTopTracks.json();
  const topTracks = topTracksData.tracks;
  const topTracksFiltered = [];
  for (const topTrack of topTracks) {
    const responseTopTrackAudioFeatures = await fetch(`https://api.spotify.com/v1/audio-features/${topTrack.id}`, {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`
      }
    });
    const topTrackAudioFeatures = await responseTopTrackAudioFeatures.json();

    if (topTrackAudioFeatures.danceability >= mindanceability && topTrackAudioFeatures.danceability <= maxdanceability &&
        topTrackAudioFeatures.energy >= minenergy && topTrackAudioFeatures.energy <= maxenergy &&
        topTrackAudioFeatures.valence >= minvalence && topTrackAudioFeatures.valence <= maxvalence) {
      topTracksFiltered.push(topTrack);
    }
  }
    // Use audio feature ranges to get track recommendations
    const responseRecommendations = await fetch(`https://api.spotify.com/v1/recommendations?seed_tracks=${trackId}&market=US&limit=100&min_danceability=${mindanceability}&max_danceability=${maxdanceability}&min_energy=${minenergy}&max_energy=${maxenergy}&min_valence=${minvalence}&max_valence=${maxvalence}`, {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`
      }
    });
    const dataRecommendations = await responseRecommendations.json();
    const similarTracks = dataRecommendations.tracks;
    const combinedTracks = [...similarTracks, ...topTracksFiltered];

    combinedTracks.sort((track1, track2) => {
      const diff1 = calculateDifference(track1, danceability, energy, valence);
      const diff2 = calculateDifference(track2, danceability, energy, valence);
      return diff1 - diff2;
    });

    return combinedTracks;
  }
  function calculateDifference(track, danceability, energy, valence) {
    const trackAudioFeatures = track.audio_features;
    if (!trackAudioFeatures) return Infinity; // Handle undefined audio features

    const trackDanceability = trackAudioFeatures.danceability;
    const trackEnergy = trackAudioFeatures.energy;
    const trackValence = trackAudioFeatures.valence;

    if (trackDanceability === undefined || trackEnergy === undefined || trackValence === undefined) return Infinity; // Handle undefined audio feature values

    const diffDanceability = Math.abs(trackDanceability - danceability);
    const diffEnergy = Math.abs(trackEnergy - energy);
    const diffValence = Math.abs(trackValence - valence);

    // You can customize the calculation of overall difference based on your preference
    return diffDanceability + diffEnergy + diffValence;
  }

  async function searchSong(query) {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track`, {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`
      }
    });
    const data = await response.json();
    return data.tracks.items; // Returns an array of search results
  }

  async function getTrackDetails(trackId) {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`
      }
    });
    const data = await response.json();
    return data; // Returns details of the track
  }

  async function searchTracksByGenres(genres) {
    const genreQuery = genres.map(genre => `genre:"${genre}"`).join(' OR ');
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(genreQuery)}&type=track`, {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`
      }
    });
    const data = await response.json();
    return data.tracks.items; // Returns an array of search results
  }

  async function getAccessToken() {
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const basicAuthHeader = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuthHeader}`
      },
      body: 'grant_type=client_credentials'
    });
    const data = await response.json();
    return data.access_token;
  }

  function displayResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    if (results.length === 0) {
      resultsContainer.innerHTML = '<p>No results found</p>';
      return;
    }

    results.forEach(result => {
      const listItem = document.createElement('div');
      listItem.classList.add('result-item');
      listItem.dataset.trackId = result.id;
      listItem.textContent = `${result.name} by ${result.artists.map(artist => artist.name).join(', ')}`;
      resultsContainer.appendChild(listItem);
    });

    resultsContainer.style.display = 'block'; // Show the dropdown
  }

  function clearResults() {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'none'; // Hide the dropdown
  }

  async function displayTrackDetails(trackDetails) {
    const trackInfoContainer = document.getElementById('songDetails');
    trackInfoContainer.innerHTML = `
    <h1> Original Song </h1>
    <img src="${trackDetails.album.images[0].url}" alt="Album Poster" width="150">
      <h4>${trackDetails.name } -  ${trackDetails.artists.map(artist => artist.name).join(', ')} </h4>
      <div>
      <audio controls>
        <source src="${trackDetails.preview_url}" type="audio/mpeg">
        Your browser does not support the audio element.
      </audio>
      </div>
      <a href="${trackDetails.external_urls.spotify}" target="_blank">Listen on Spotify</a>
    `;
    const audioElement = trackInfoContainer.querySelector('audio');
    audioElement.addEventListener('play', () => {
      // Pause the currently playing audio, if any
      if (currentlyPlayingAudio && currentlyPlayingAudio !== audioElement) {
        currentlyPlayingAudio.pause();
      }
      // Set the currently playing audio to the current audio element
      currentlyPlayingAudio = audioElement;
    });
    audioElement.addEventListener('pause', () => {
      // Reset the currently playing audio if it's the same as the paused audio
      if (currentlyPlayingAudio === audioElement) {
        currentlyPlayingAudio = null;
      }
    });
  }

  async function displaySimilarTracks(similarTracks,trackDetails) {
    const similarhead = document.getElementById('similarhead');
    similarhead.innerHTML = '';
    const similarTracksContainer = document.getElementById('similarSongs');
    similarTracksContainer.style.display = 'flex';
    similarTracksContainer.innerHTML = '';
    
    if (similarTracks.length === 0) {
      similarTracksContainer.innerHTML = '<p>No similar tracks found</p>';
      return;
    }
    
    similarTracks.forEach(track => {
      if (track.name === trackDetails.name && track.artists.map(artist => artist.name).join(', ') === trackDetails.artists.map(artist => artist.name).join(', ')) {
        return;
    }
      const listItem = document.createElement('div');
      listItem.classList.add('results');
      listItem.innerHTML = `
        
        <img src="${track.album.images[0].url}" alt="Album Poster" width="150">
        <div>
          <h4>${track.name} - ${track.artists.map(artist => artist.name).join(', ')}</h4>
        </div>
        <div>
        <audio controls class="similar-audio">
            <source src="${track.preview_url}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
          </div>
          <a href="${track.external_urls.spotify}" target="_blank">Listen on Spotify</a>
      `;
      similarTracksContainer.appendChild(listItem);
      const audioElement = listItem.querySelector('audio');
      audioElement.addEventListener('play', () => {
        // Pause the currently playing audio, if any
        if (currentlyPlayingAudio && currentlyPlayingAudio !== audioElement) {
          currentlyPlayingAudio.pause();
        }
        // Set the currently playing audio to the current audio element
        currentlyPlayingAudio = audioElement;
      });
      audioElement.addEventListener('pause', () => {
        // Reset the currently playing audio if it's the same as the paused audio
        if (currentlyPlayingAudio === audioElement) {
          currentlyPlayingAudio = null;
        }
      });
    });
  }
  extractAccessToken();

  // If access token is not present, initiate authentication
  if (!accessToken) {
    authenticate();
    return; // Stop further execution until authentication is completed
  }
  function msToMinutesAndSeconds(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${(seconds < 10 ? '0' : '')}${seconds}`;
  }
});
