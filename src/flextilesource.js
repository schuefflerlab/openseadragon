/*
 * OpenSeadragon - FlexTileSource
 *
 * Author: Peter J. Schueffler (schueffp@mskcc.org)
 *
 * Copyright (C) 2009 CodePlex Foundation
 * Copyright (C) 2010-2013 OpenSeadragon contributors
 * Copyright (C) 2018-2019 Peter J. Schueffler
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * - Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 *
 * - Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in the
 *   documentation and/or other materials provided with the distribution.
 *
 * - Neither the name of CodePlex Foundation nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

(function( $ ){

/**
 * @class FlexTileSource
 * @classdesc The FlexTileSource allows simple, native image pyramids with individual tiling per level to be loaded
 * into an OpenSeadragon Viewer.
 * Basically, this translates to the historically
 * common practice of starting with a 'master' image, maybe a tiff for example,
 * and generating a set of 'service' images like one or more thumbnails, a medium
 * resolution image and a high resolution image in standard web formats like
 * png or jpg.
 *
 * @memberof OpenSeadragon
 * @extends OpenSeadragon.TileSource
 * @param {Array} levels An array of file descriptions, each is an object with
 *      a 'url', a 'width', and a 'height'.  Overriding classes can expect more
 *      properties but these properties are sufficient for this implementation.
 *      Additionally, the levels are required to be listed in order from
 *      smallest to largest.
 * @property {Number} aspectRatio
 * @property {Number} dimensions
 * @property {Number} tileSize
 * @property {Number} tileOverlap
 * @property {Number} minLevel
 * @property {Number} maxLevel
 * @property {Array}  levels
 */
$.FlexTileSource = function( configuration ) {

    var options,
        width,
        height;

    options = {
        type: 'flex-image-pyramid',
        levels: configuration.levels,
        tilesUrl: configuration.tilesUrl,
        fileFormat: configuration.fileFormat,
        queryParams: configuration.queryParams
    };

    //clean up the levels to make sure we support all formats
    options.levels = filterFiles( options.levels );

    if ( options.levels.length > 0 ) {
        width = options.levels[ options.levels.length - 1 ].width;
        height = options.levels[ options.levels.length - 1 ].height;
    }
    else {
        width = 0;
        height = 0;
        $.console.error( "No supported image formats found" );
    }

    $.extend( true, options, {
        width: width,
        height: height,
        tileOverlap: 0,
        minLevel: 0,
        maxLevel: options.levels.length > 0 ? options.levels.length - 1 : 0
    } );

    this.fileFormat = options.fileFormat;
    this.levels = options.levels;
    this.tilesUrl = options.tilesUrl;

    $.TileSource.apply(this, [options]);
};

$.extend( $.FlexTileSource.prototype, $.TileSource.prototype, /** @lends OpenSeadragon.FlexTileSource.prototype */{
    /**
     * Determine if the data and/or url imply the image service is supported by
     * this tile source.
     * @function
     * @param {Object|Array} data
     * @param {String} optional - url
     */
    supports: function( data, url ){
        return (
            data.type &&
            "flex-image-pyramid" === data.type
        ) || (
            data.documentElement &&
            "flex-image-pyramid" === data.documentElement.getAttribute('type')
        );
    },


    /**
     *
     * @function
     * @param {Object|XMLDocument} configuration - the raw configuration
     * @param {String} dataUrl - the url the data was retreived from if any.
     * @return {Object} options - A dictionary of keyword arguments sufficient
     *      to configure this tile sources constructor.
     */
    configure: function( configuration, dataUrl ){

        var options,
            url;

        url = dataUrl || configuration.url;

        if( !$.isPlainObject(configuration) ){

            options = configureFromXML( this, configuration );

        } else {
            options = configureFromObject( this, configuration );
        }

        if (url && !options.tilesUrl) {
            options.tilesUrl = url.replace(
                /([^/]+?)(\.(flex|xml|js)?(\?[^/]*)?)?\/?$/, '$1_files/');

            if (url.search(/\.(flex|xml|js)\?/) !== -1) {
                options.queryParams = url.match(/\?.*/);
            } else {
                options.queryParams = '';
            }
        }

        return options;
    },

    /**
     * Return the tileWidth for a given level.
     * @function
     * @param {Number} level
     */
    getTileWidth: function (level) {
        if (this.levels.length > level) {
            return this.levels[level].tileWidth;
        }
        return this._tileWidth;
    },

    /**
     * Return the tileHeight for a given level.
     * @function
     * @param {Number} level
     */
    getTileHeight: function (level) {
        if (this.levels.length > level) {
            return this.levels[level].tileHeight;
        }
        return this._tileHeight;
    },

    /**
     * @function
     * @param {Number} level
     */
    getLevelScale: function ( level ) {
        var levelScale = NaN;
        if ( this.levels.length > 0 && level >= this.minLevel && level <= this.maxLevel ) {
            levelScale =
                this.levels[ level ].width /
                this.levels[ this.maxLevel ].width;
        }
        return levelScale;
    },

    /**
     * @function
     * @param {Number} level
     */
    getNumTiles: function( level ) {
        var x = Math.ceil( this.levels[level].width / this.getTileWidth(level) ),
            y = Math.ceil( this.levels[level].height / this.getTileHeight(level) );

        return new $.Point( x, y );
    },

    /**
     * @function
     * @param {Number} level
     * @param {Number} x
     * @param {Number} y
     * @throws {Error}
     */
    getTileUrl: function (level, x, y) {
        return [this.tilesUrl, level, '/', x, '_', y, '.', this.fileFormat, this.queryParams ].join('');
    }
} );

/**
 * This method removes any files from the Array which dont conform to our
 * basic requirements for a 'level' in the FlexTileSource.
 * @private
 * @inner
 * @function
 */
function filterFiles( files ){
    var filtered = [],
        file,
        i;
    for( i = 0; i < files.length; i++ ){
        file = files[ i ];
        if( file.height &&
            file.width &&
            file.tileHeight &&
            file.tileWidth) {
            //This is sufficient to serve as a level
            filtered.push({
                width: Number( file.width ),
                height: Number( file.height ),
                tileWidth: Number( file.tileWidth ),
                tileHeight: Number( file.tileHeight )
            });
        }
        else {
            $.console.error( 'Unsupported image format: %s', file.url ? file.url : '<no URL>' );
        }
    }

    return filtered.sort(function(a, b) {
        return a.height - b.height;
    });

}

/**
 * @private
 * @inner
 * @function
 */
function configureFromXML( tileSource, xmlDoc ){

    if ( !xmlDoc || !xmlDoc.documentElement ) {
        throw new Error( $.getString( "Errors.Xml" ) );
    }

    var root         = xmlDoc.documentElement,
        rootName     = root.tagName,
        conf         = null,
        levels       = [],
        level,
        i;

    if ( rootName === "image" ) {

        try {
            conf = {
                type: root.getAttribute("type"),
                fileFormat: root.getAttribute("fileFormat"),
                url: root.getAttribute("url"),
                levels:      []
            };

            levels = root.getElementsByTagName( "level" );
            for ( i = 0; i < levels.length; i++ ) {
                level = levels[ i ];

                conf.levels.push({
                    width:  parseInt( level.getAttribute( "width" ), 10 ),
                    height: parseInt(level.getAttribute("height"), 10),
                    tileWidth: parseInt(level.getAttribute("tileWidth"), 10),
                    tileHeight: parseInt(level.getAttribute("tileHeight"), 10)
                });
            }

            return configureFromObject( tileSource, conf );

        } catch ( e ) {
            throw (e instanceof Error) ?
                e :
                new Error( 'Unknown error parsing Flex Image Pyramid XML.' );
        }
    } else if ( rootName === "collection" ) {
        throw new Error( 'Flex Image Pyramid Collections not yet supported.' );
    } else if ( rootName === "error" ) {
        throw new Error( 'Error: ' + xmlDoc );
    }

    throw new Error( 'Unknown element ' + rootName );
}

/**
 * @private
 * @inner
 * @function
 */
function configureFromObject( tileSource, configuration ){

    return configuration;

}

}( OpenSeadragon ));
